export interface CharacterCard {
  name: string;
  description: string;
  personality: string;
  first_mes: string;
  scenario: string;
  avatar: string;
  tags: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  character: CharacterCard;
  messages: ChatMessage[];
  lastActivity: Date;
}
