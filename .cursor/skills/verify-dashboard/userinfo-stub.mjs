import { createServer } from "node:http";

const token = process.env.VERIFY_ACCESS_TOKEN;
const sub = process.env.VERIFY_OFFICER_SUB;
const port = Number(process.env.PORT);

if (!token || !sub || !Number.isInteger(port) || port <= 0) {
	console.error("VERIFY_ACCESS_TOKEN, VERIFY_OFFICER_SUB, and PORT are required");
	process.exit(1);
}

const server = createServer((request, response) => {
	const url = request.url ?? "";
	if (!url.includes("/oidc/me")) {
		response.writeHead(404);
		response.end();
		return;
	}
	if (request.headers.authorization !== `Bearer ${token}`) {
		response.writeHead(401);
		response.end();
		return;
	}
	response.writeHead(200, { "content-type": "application/json" });
	response.end(JSON.stringify({ sub, name: "Local Officer" }));
});

server.listen(port, "127.0.0.1", () => {
	console.log(JSON.stringify({ port }));
});
