import { Ai } from "@cloudflare/ai";

export interface Env {
	AI: Ai;
	SECRET_KEY: string;
}

export default {
	async fetch(request: Request, env: Env) {
		const apiKey = request.headers.get("X-Api-Key");
		if (
			apiKey == null ||
			apiKey !== env.SECRET_KEY ||
			request.method.toUpperCase() !== "POST"
		) {
			return new Response(null, { status: 404 });
		}

		if (request.body == null) {
			return new Response(null, { status: 400 });
		}

		try {
			for await (const chunk of request.body) {
				const ai = new Ai(env.AI);
				const input = {
					audio: [...chunk],
				};
				const response = await ai.run<"@cf/openai/whisper">(
					"@cf/openai/whisper",
					input,
				);
				return Response.json(response);
			}
		} catch (error) {
			return new Response(error instanceof Error ? error.message : null, {
				status: 500,
			});
		}
	},
};
