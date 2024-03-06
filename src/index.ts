import { Ai } from "@cloudflare/ai";
import { html } from "./html";

export interface Env {
	AI: Ai;
	TEXT: KVNamespace;
	SECRET_KEY: string;
}

export default {
	async fetch(request: Request, env: Env) {
		try {
			const { pathname } = new URL(request.url);

			if (
				request.method.toUpperCase() === "GET" &&
				pathname === "/index.html"
			) {
				return new Response(html, { headers: { "Content-Type": "html" } });
			}

			const apiKey = request.headers.get("X-Api-Key");
			if (apiKey == null || apiKey !== env.SECRET_KEY) {
				return new Response(null, { status: 404 });
			}

			if (request.method.toUpperCase() === "POST") {
				if (request.body == null) {
					return new Response(null, { status: 400 });
				}
				const blob = await request.arrayBuffer();
				console.log(blob);
				const ai = new Ai(env.AI);
				const input = {
					audio: [...new Uint8Array(blob)],
				};
				const response = await ai.run<"@cf/openai/whisper">(
					"@cf/openai/whisper",
					input,
				);

				await env.TEXT.put(new Date().getTime().toString(), response.text, {
					expirationTtl: 604800, // one week
				});

				return Response.json(response);
			}

			if (request.method.toUpperCase() === "GET" && pathname === "/key") {
				const list = await env.TEXT.list();
				return Response.json({ keys: list.keys.map((key) => key.name) });
			}

			if (request.method.toUpperCase() === "GET") {
				const text = await env.TEXT.get(pathname.substring(1));
				return Response.json({ text }, { status: 200 });
			}

			return new Response(null, { status: 404 });
		} catch (error) {
			console.log(error);
			return new Response(error instanceof Error ? error.message : null, {
				status: 500,
			});
		}
	},
};
