import type { AppLoadContext } from '@remix-run/node';
import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import { renderToPipeableStream } from 'react-dom/server';
import { renderHeadToString } from 'remix-island';
import { Head } from './root';
import { themeStore } from '~/lib/stores/theme';
import { PassThrough, Transform } from 'node:stream';

const ABORT_DELAY = 5_000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: any,
  _loadContext: AppLoadContext,
) {
  const callbackName = isbot(request.headers.get('user-agent') || '') ? 'onAllReady' : 'onShellReady';

  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} abortDelay={ABORT_DELAY} />,
      {
        [callbackName]: () => {
          shellRendered = true;
          const body = new PassThrough();
          const head = renderHeadToString({ request, remixContext, Head });

          responseHeaders.set('Content-Type', 'text/html');
          responseHeaders.set('Cross-Origin-Embedder-Policy', 'credentialless');
          responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

          // Write the HTML shell
          body.write(
            `<!DOCTYPE html><html lang="en" data-theme="${themeStore.value}"><head>${head}</head><body><div id="root" class="w-full h-full">`,
          );

          resolve(
            new Response(body as unknown as ReadableStream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );

          // Create a transform stream to append closing tags after React content
          const appendClosingTags = new Transform({
            transform(chunk, encoding, callback) {
              callback(null, chunk);
            },
            flush(callback) {
              this.push('</div></body></html>');
              callback();
            },
          });

          // Pipe React content through transform (which appends closing tags) to body
          pipe(appendClosingTags).pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        },
      },
    );

    setTimeout(abort, ABORT_DELAY);
  });
}
