/*import type { Request, Response, NextFunction } from "express";
import { getRAGResponse } from "../services/rag.service.ts";

// POST /api/chat/message
export const sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(400).json({ success: false, message: "Message is required." });
      return;
    }

    const answer = await getRAGResponse(message.trim());

    res.json({ success: true, data: { message: answer } });
  } catch (error) { next(error); }
};*/

import type { Request, Response, NextFunction } from "express";
import { getRAGResponse } from "../services/rag.service.ts";

// POST /api/chat/message
export const sendMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const message =
      typeof req.body?.message === "string"
        ? req.body.message.trim()
        : typeof req.body?.question === "string"
        ? req.body.question.trim()
        : "";

    if (!message) {
      res.status(400).json({
        success: false,
        message: "Please enter a question.",
      });
      return;
    }

    if (message.length > 2000) {
      res.status(400).json({
        success: false,
        message: "Please keep your question under 2000 characters.",
      });
      return;
    }

    const answer = await getRAGResponse(message);

    res.status(200).json({
      success: true,
      data: {
        message: answer,
      },
    });
  } catch (error) {
    next(error);
  }
};
