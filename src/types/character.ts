import { CharacterBook } from "./taverncard";

export interface CharacterCard {
  name: string;
  description: string;
  personality: string;
  first_mes: string;
  scenario: string;
  avatar: string;
  tags: string[];
  character_book?: CharacterBook;
  system_prompt?: string;
  mes_example?: string;
}

export interface ActiveNPC {
  name: string;
  description?: string;
  personality?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  character: CharacterCard;
  messages: ChatMessage[];
  lastActivity: Date;
}
