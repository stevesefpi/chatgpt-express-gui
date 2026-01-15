export async function generateChatTitle(openaiClient, firstUserMessage) {
    const response = await openaiClient.responses.create({
        model: "gpt-5.2",
        input: [
            {
                role: "system",
                content: "Create a short chat title. It must have 2 to 6 words maximum. No quotes. No punctuation at the end. Title case. Do not include emojis. Do not include extra symbols. Do not try to make it bold. Just simple text. Just the 2 to 6 word title and nothing else at all.",
            },
            { role: "user", content: firstUserMessage },
        ],
        max_output_tokens: 20,
    });

    return (response.output_text || "New chat").trim();
} 

export function base64ToBuffer(b64) {
    return Buffer.from(b64, "base64");
}

export function makeFileName(userId, crypto) {
    const id = crypto.randomUUID();
    return `${userId}/${Date.now()}-${id}.png`;
}