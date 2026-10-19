export type TelegramReplyMarkup = {
  inline_keyboard: Array<Array<{ text: string; url: string }>>;
};

export type RegistrationTelegramMessage = {
  text: string;
  replyMarkup: TelegramReplyMarkup;
};

export function buildRegistrationTelegramMessage(input: {
  eventName: string;
  reviewUrl: string;
}): RegistrationTelegramMessage {
  return {
    text: `Nuevo registro para ${input.eventName}\nHay una nueva solicitud pendiente de revisión. Revisá al candidato para decidir si puede asistir.`,
    replyMarkup: {
      inline_keyboard: [[{ text: "Revisar solicitud", url: input.reviewUrl }]],
    },
  };
}

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
  if (!response.ok) throw new Error(`Telegram request failed with status ${response.status}`);
  const result = await response.json() as { ok?: boolean };
  if (!result.ok) throw new Error("Telegram rejected the message");
}
