/*import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import { createAgent, tool } from "langchain";
//import { ChatOpenAI } from "@langchain/openai";
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { z } from "zod";


// --- MongoDB Native Client (for LangChain vector operations) ---
// ---- __dirname for ESM ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- MongoDB native client ----
let mongoClient: MongoClient | null = null;

const getMongoClient = async (): Promise<MongoClient> => {
  if (!mongoClient) {
    mongoClient = new MongoClient(process.env.MONGODB_URI || "");
    await mongoClient.connect();
  }
  return mongoClient;
};


// ---- Google GenAI Embeddings ----
// gemini-embedding-001 → default 3072 dimensions (FREE, same API key as Gemini chat)
const getEmbeddings = () => {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is not set in .env!");
  }
  return new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    model: "gemini-embedding-001",
  });
};


// ---- Vector Store ----
const getVectorStore = async () => {
  const client = await getMongoClient();
  const collection = client.db("edureach_db").collection("knowledge_docs");

  return new MongoDBAtlasVectorSearch(getEmbeddings(), {
    collection: collection as any,
    indexName: "edureach_vector_index",
    textKey: "text",
    embeddingKey: "embedding",
  });
};

// --- Initialize Knowledge Base ---

// A) INDEXING — runs ONCE at server startup
// ============================================
export const initializeKnowledgeBase = async (): Promise<void> => {
  const client = await getMongoClient();
  const collection = client.db("edureach_db").collection("knowledge_docs");

  // Check if docs exist WITH valid (non-empty) embeddings
  const docWithEmbedding = await collection.findOne({
    embedding: { $exists: true, $not: { $size: 0 } },
  });

  if (docWithEmbedding) {
    const count = await collection.countDocuments();
    console.log(` Knowledge base ready (${count} chunks with embeddings)`);
    return;
  }

  // If docs exist but embeddings are empty → delete and re-index
  const existingCount = await collection.countDocuments();
  if (existingCount > 0) {
    console.log(` Found ${existingCount} chunks with EMPTY embeddings — deleting & re-indexing...`);
    await collection.deleteMany({});
  }

  console.log(" Indexing knowledge base...");

  // Verify API key FIRST with a test embedding
  const embeddings = getEmbeddings();
  try {
    const testResult = await embeddings.embedQuery("test");
    console.log(` API key OK — embedding dimensions: ${testResult.length}`);
  } catch (error: any) {
    console.error(" Embedding test failed!");
    console.error("   Error:", error.message || error);
    console.error("   Get key from: https://aistudio.google.com/apikey");
    throw error;
  }

  // LOAD
  const filePath = path.join(__dirname, "../../knowledge-base/edureach-knowledge.txt");
  const loader = new TextLoader(filePath);
  const docs = await loader.load();
  if (docs.length === 0) {
    throw new Error("No documents found in knowledge base file");
  }
  const totalCharacters = docs.reduce((sum, doc) => sum + doc.pageContent.length, 0);
  console.log(`    Loaded ${totalCharacters} characters`);

  // SPLIT
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const allSplits = await splitter.splitDocuments(docs);
  console.log(`    Split into ${allSplits.length} chunks`);

  // EMBED + STORE
  const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
    collection: collection as any,
    indexName: "edureach_vector_index",
    textKey: "text",
    embeddingKey: "embedding",
  });

  await vectorStore.addDocuments(allSplits);

  // VERIFY
  const verifyDoc = await collection.findOne({
    embedding: { $exists: true, $not: { $size: 0 } },
  });

  if (verifyDoc && Array.isArray(verifyDoc.embedding) && verifyDoc.embedding.length > 0) {
    console.log(`    ${allSplits.length} chunks stored (${verifyDoc.embedding.length}D embeddings)`);
    console.log(`     IMPORTANT: Create Atlas Vector Search index with numDimensions: ${verifyDoc.embedding.length}`);
  } else {
    await collection.deleteMany({});
    throw new Error(" Embeddings are empty! Google API returned no vectors.");
  }
};


const createRetrieveTool = (vectorStore: MongoDBAtlasVectorSearch) => {
  return tool(
    async ({ query }: { query: string }) => {
      const retrievedDocs = await vectorStore.similaritySearch(query, 3);
      return retrievedDocs
        .map((doc) => `Source: ${doc.metadata.source}\nContent: ${doc.pageContent}`)
        .join("\n\n");
    },
    {
      name: "retrieve",
      description:
        "Retrieve information from the EduReach College knowledge base. " +
        "Use this for any questions about courses, fees, admissions, mentors, campus, placements.",
      schema: z.object({ query: z.string() }),
    }
  );
};

// --- Get RAG Response ---
export const getRAGResponse = async (question: string): Promise<string> => {
  try {
    const vectorStore = await getVectorStore();
    const retrieve = createRetrieveTool(vectorStore);

    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      temperature: 0.7,
    });

    const agent = createAgent({
      model,
      tools: [retrieve],
      systemPrompt:
        "You are EduReach Bot, a helpful AI counselor for EduReach College, Hyderabad. " +
        "ALWAYS use the retrieve tool to search the knowledge base before answering. " +
        "Be concise, friendly, and professional. " +
        "If the information is not found, say: " +
        "'I don't have that information right now. Click Talk to Us to speak with a counselor.'",
    });

    const result = await agent.invoke({
      messages: [{ role: "user", content: question }],
    });

    const messages = result.messages;
    const lastMessage = messages[messages.length - 1];

    if (!lastMessage) {
      return "I couldn't generate a response. Please try again.";
    }

    return typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);
  } catch (error) {
    console.error(" RAG Agent Error:", error);
    return "I'm having trouble right now. Please try again or click 'Talk to Us'.";
  }
};*/

import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient, type Collection } from "mongodb";

import { ChatOpenAI } from "@langchain/openai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_NAME = "edureach_db";
const COLLECTION_NAME = "knowledge_docs";

// IMPORTANT: Your Atlas screenshot shows the Search index name is "default".
// If you create/rename the Atlas index to "edureach_vector_index", change this value.
const VECTOR_INDEX_NAME = "default";

const FALLBACK_MESSAGE =
  "I don't have that information right now. Click Talk to Us to speak with a counselor.";

let mongoClient: MongoClient | null = null;

const getMongoClient = async (): Promise<MongoClient> => {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from .env");
  }

  if (!mongoClient) {
    mongoClient = new MongoClient(process.env.MONGODB_URI);
    await mongoClient.connect();
    console.log("RAG: MongoDB connected.");
  }

  return mongoClient;
};

const getEmbeddings = (): GoogleGenerativeAIEmbeddings => {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is missing from .env");
  }

  return new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    model: "gemini-embedding-001",
  });
};

const getCollection = async (): Promise<Collection> => {
  const client = await getMongoClient();
  return client.db(DATABASE_NAME).collection(COLLECTION_NAME);
};

const getVectorStore = async (): Promise<MongoDBAtlasVectorSearch> => {
  const collection = await getCollection();

  return new MongoDBAtlasVectorSearch(getEmbeddings(), {
    collection,
    indexName: VECTOR_INDEX_NAME,
    textKey: "text",
    embeddingKey: "embedding",
  });
};

const getChatModel = (): ChatOpenAI => {
  const apiKey = process.env.OLLAMA_API_KEY;

  if (!apiKey) {
    throw new Error("OLLAMA_API_KEY is missing from .env");
  }

  return new ChatOpenAI({
    model: process.env.OLLAMA_MODEL || "gemma4:31b",
    apiKey,
    temperature: 0.2,
    configuration: {
      baseURL: "https://ollama.com/v1",
    },
  });
};

// Set REINDEX_KNOWLEDGE_BASE=true in .env for ONE startup to rebuild the
// knowledge_docs collection. After a successful run, remove the variable or
// set it to false before restarting again.
export const initializeKnowledgeBase = async (): Promise<void> => {
  const collection = await getCollection();
  const existingCount = await collection.countDocuments();
  const forceReindex = process.env.REINDEX_KNOWLEDGE_BASE === "true";

  if (forceReindex) {
    console.log("RAG: Re-index requested. Clearing ONLY edureach_db.knowledge_docs.");
    await collection.deleteMany({});
  } else if (existingCount > 0) {
    const validEmbedding = await collection.findOne({
      embedding: { $exists: true, $type: "array", $ne: [] },
    });

    if (validEmbedding) {
      console.log(
        `RAG: Found ${existingCount} existing documents. Skipping indexing.`
      );
      console.log(
        "RAG: To rebuild after changing the knowledge file, set REINDEX_KNOWLEDGE_BASE=true for one startup."
      );
      return;
    }

    console.log("RAG: Removing incomplete documents before indexing.");
    await collection.deleteMany({});
  }

  const filePath = path.resolve(
    __dirname,
    "../../knowledge-base/edureach-knowledge.txt"
  );

  console.log("RAG: Loading knowledge file:", filePath);

  const loader = new TextLoader(filePath);
  const docs = await loader.load();

  if (!docs.length || !docs.some((doc) => doc.pageContent.trim())) {
    throw new Error("Knowledge-base file is empty or contains no text.");
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const chunks = await splitter.splitDocuments(docs);

  if (!chunks.length) {
    throw new Error("No text chunks were created.");
  }

  console.log(`RAG: Creating embeddings for ${chunks.length} chunks.`);

  const vectorStore = await getVectorStore();
  await vectorStore.addDocuments(chunks);

  const storedCount = await collection.countDocuments();
  const verifyDoc = await collection.findOne({
    embedding: { $exists: true, $type: "array", $ne: [] },
  });

  if (!verifyDoc || !Array.isArray(verifyDoc.embedding) || verifyDoc.embedding.length === 0) {
    throw new Error("RAG: Indexing finished, but no valid embeddings were found.");
  }

  console.log("RAG: Knowledge base indexing completed.");
  console.log(`RAG: Stored documents: ${storedCount}`);
  console.log(`RAG: Embedding dimensions: ${verifyDoc.embedding.length}`);
};

export const getRAGResponse = async (question: string): Promise<string> => {
  try {
    const cleanQuestion = question.trim();

    if (!cleanQuestion) {
      return "Please enter a question.";
    }

    console.log("\nRAG: Question received:", cleanQuestion);

    const collection = await getCollection();
    const totalDocuments = await collection.countDocuments();

    console.log("RAG: Total stored documents:", totalDocuments);

    if (totalDocuments === 0) {
      console.error("RAG: Collection is empty. Check initializeKnowledgeBase().");
      return FALLBACK_MESSAGE;
    }

    const vectorStore = await getVectorStore();
    const retrievedDocs = await vectorStore.similaritySearch(cleanQuestion, 4);

    console.log("RAG: Retrieved documents:", retrievedDocs.length);

    retrievedDocs.forEach((doc, index) => {
      console.log(`RAG: Document ${index + 1}:`, doc.pageContent.slice(0, 500));
    });

    if (!retrievedDocs.length) {
      console.error(
        `RAG: No documents retrieved. Confirm Atlas Search index "${VECTOR_INDEX_NAME}" is READY/QUERYABLE and uses the correct vector field/dimensions.`
      );
      return FALLBACK_MESSAGE;
    }

    const context = retrievedDocs
      .map((doc, index) => `Document ${index + 1}:\n${doc.pageContent}`)
      .join("\n\n---\n\n");

    const model = getChatModel();

    const response = await model.invoke([
      {
        role: "system",
        content: `
You are EduReach Bot, an assistant for EduReach College in Hyderabad.
Answer the user's college-related question using only facts supported by the supplied context.
Do not invent courses, fees, admission rules, placements, or facilities.
If the context does not contain the answer, say:
"${FALLBACK_MESSAGE}"
Keep answers concise, friendly, and clear.
Answer in the same language as the user.

KNOWLEDGE BASE:
${context}
        `.trim(),
      },
      { role: "user", content: cleanQuestion },
    ]);

    const answer =
      typeof response.content === "string"
        ? response.content.trim()
        : response.content
            .map((part) => (part.type === "text" ? part.text : ""))
            .join("")
            .trim();

    console.log("RAG: Model answer:", answer);
    return answer || FALLBACK_MESSAGE;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("RAG ERROR:", message);
    return "I'm having trouble right now. Please try again or click 'Talk to Us'.";
  }
};

export const closeRAGMongoConnection = async (): Promise<void> => {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    console.log("RAG: MongoDB connection closed.");
  }
};
