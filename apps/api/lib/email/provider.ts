export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export interface EmailProvider {
  readonly name: string;
  isConfigured(): boolean;
  send(input: SendEmailInput): Promise<void>;
}
