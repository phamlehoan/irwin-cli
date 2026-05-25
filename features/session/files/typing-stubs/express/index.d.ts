type FlashPayload = string | Record<string, string>;

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      flash(): Record<string, FlashPayload[]>;
      flash(event: string, message: FlashPayload): void;
    }
  }
}

export {};
