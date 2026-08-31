export default {
  async fetch(request, env) {

    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors
      });
    }

    const url = new URL(request.url);

    if (url.pathname !== "/chat") {
      return json(
        {ok:true,message:"AI Worker работает"},
        200,
        cors
      );
    }

    if (request.method !== "POST") {
      return json(
        {error:"POST required"},
        405,
        cors
      );
    }

    try {

      if (!env.OPENAI_API_KEY) {
        return json(
          {error:"OPENAI_API_KEY не настроен"},
          500,
          cors
        );
      }

      const body = await request.json();

      const messages =
        Array.isArray(body.messages)
        ? body.messages
        : [];

      if (!messages.length) {
        return json(
          {error:"Нет сообщений"},
          400,
          cors
        );
      }

      const input = messages
        .slice(-30)
        .map(m => ({
          role:
            m.role === "assistant"
              ? "assistant"
              : "user",
          content: String(m.content || "")
        }));

      const response = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method:"POST",
          headers:{
            "Content-Type":"application/json",
            "Authorization":
              "Bearer "+env.OPENAI_API_KEY
          },
          body:JSON.stringify({
            model: env.OPENAI_MODEL || "gpt-5.6-luna",
            instructions:
              "Ты полезный русскоязычный AI-помощник. Отвечай понятно, естественно и по существу.",
            input: input,
            store: false
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {

        return json(
          {
            error:
              data?.error?.message ||
              "OpenAI API error"
          },
          response.status,
          cors
        );
      }

      let answer="";

      if (typeof data.output_text === "string") {
        answer=data.output_text;
      }

      if (!answer && Array.isArray(data.output)) {

        for (const item of data.output) {

          if (!Array.isArray(item.content))
            continue;

          for (const part of item.content) {

            if (
              part.type === "output_text" &&
              typeof part.text === "string"
            ) {
              answer+=part.text;
            }
          }
        }
      }

      if (!answer) {
        answer="Модель не вернула текстовый ответ.";
      }

      return json(
        {
          answer:answer
        },
        200,
        cors
      );

    } catch(error) {

      return json(
        {
          error:
            error?.message ||
            "Internal Worker error"
        },
        500,
        cors
      );
    }
  }
};

function json(data,status,extra={}){

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers:{
        "Content-Type":
          "application/json; charset=utf-8",
        ...extra
      }
    }
  );
}
