/**
 * Utilitário de Integração do WhatsApp para envio do código de confirmação de senha.
 * Esta estrutura está pronta para produção e pode ser ativada utilizando Twilio ou outro Gateway API.
 */

// URL e chave de API do serviço de mensagens (geralmente lidas de variáveis de ambiente)
const WHATSAPP_API_URL =
  typeof process !== "undefined" && process.env ? process.env.VITE_WHATSAPP_API_URL || "" : "";
const WHATSAPP_API_KEY =
  typeof process !== "undefined" && process.env ? process.env.VITE_WHATSAPP_API_KEY || "" : "";

/**
 * Envia uma mensagem via WhatsApp contendo o código de confirmação de 4 dígitos.
 *
 * @param phone Telefone formatado do destinatário (Ex: "(61) 99999-9999")
 * @param code O código numérico de 4 dígitos gerado
 */
export async function sendWhatsAppVerificationCode(phone: string, code: string): Promise<boolean> {
  const cleanPhone = phone.replace(/\D/g, "");
  const messageText = `SafraSense: Seu código de confirmação para alteração de senha é: ${code}`;

  // Exibição em log no terminal/console do servidor para fins de depuração e demonstração local
  console.log(
    `[WhatsApp API] Chamando API externa para enviar mensagem para +55${cleanPhone}. Conteúdo: "${messageText}"`,
  );

  // Em produção, basta descomentar a integração real abaixo:
  /*
  if (!WHATSAPP_API_URL || !WHATSAPP_API_KEY) {
    console.warn("Chaves do WhatsApp API não configuradas em .env");
    return false;
  }

  try {
    const response = await fetch(WHATSAPP_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${WHATSAPP_API_KEY}`
      },
      body: JSON.stringify({
        to: `whatsapp:+55${cleanPhone}`,
        text: messageText
      })
    });
    return response.ok;
  } catch (error) {
    console.error("Falha ao enviar código pelo WhatsApp API:", error);
    return false;
  }
  */

  // Retorna sucesso simulado instantâneo no desenvolvimento
  return new Promise((resolve) => setTimeout(() => resolve(true), 150));
}
