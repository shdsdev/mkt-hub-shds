export type TelegramReplyMarkup = {
  inline_keyboard: Array<Array<{ text: string; url: string }>>;
};

export type RegistrationTelegramMessage = {
  text: string;
  replyMarkup: TelegramReplyMarkup;
};

export async function sendTelegramMessage(input: {
  token: string;
  chatId: string;
  text: string;
  replyMarkup: TelegramReplyMarkup;
}): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(input.token)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: input.chatId, text: input.text, reply_markup: input.replyMarkup }),
  });
  const result = await response.json() as { ok?: boolean; description?: string };
  if (!response.ok) throw new Error(result.description ?? `Telegram request failed with status ${response.status}`);
  if (!result.ok) throw new Error(result.description ?? "Telegram rejected the message");
}

export { buildRegistrationTelegramMessage } from "./telegram-template";
