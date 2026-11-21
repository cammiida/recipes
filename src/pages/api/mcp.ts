import type { APIRoute } from 'astro';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createRecipeMcpServer } from '../../mcp/server';

export const prerender = false;

/**
 * Remote MCP endpoint (Streamable HTTP), read-only and public like the recipe pages.
 *
 * Stateless: every request gets a fresh server and transport, and responses are
 * plain JSON instead of SSE streams. Nothing is kept between requests, so this
 * runs the same on a long-lived Node server and on Lambda.
 */
export const ALL: APIRoute = async ({ request, url }) => {
  // Without sessions there is no server-to-client stream to open (GET) or session to end (DELETE).
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { allow: 'POST' } });
  }
  const server = createRecipeMcpServer(url.origin);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
};
