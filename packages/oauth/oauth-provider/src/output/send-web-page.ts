import { createHash } from 'node:crypto'
import type { ServerResponse } from 'node:http'
import { CspConfig, CspValue, mergeCsp } from '../lib/csp/index.js'
import {
  AssetRef,
  BuildDocumentOptions,
  Html,
  buildDocument,
} from '../lib/html/index.js'
import { WriteHtmlOptions, writeHtml } from '../lib/http/response.js'

export const DEFAULT_CSP: CspConfig = {
  'upgrade-insecure-requests': true,
  'default-src': ["'none'"],
}

export type SendWebPageOptions = BuildDocumentOptions & WriteHtmlOptions

export async function sendWebPage(
  res: ServerResponse,
  { csp: inputCsp, ...options }: SendWebPageOptions,
): Promise<void> {
  // @NOTE the csp string might be quite long. In that case it might be tempting
  // to set it through the http-equiv <meta> in the HTML. However, some
  // directives cannot be enforced by browsers when set through the meta tag
  // (e.g. 'frame-ancestors'). Therefore, it's better to set the CSP through the
  // HTTP header.
  const csp = mergeCsp(DEFAULT_CSP, inputCsp, {
    'base-uri': options.base?.origin as undefined | `https://${string}`,
    'script-src': options.scripts?.map(assetToCsp),
    'style-src': options.styles?.map(assetToCsp),
  })

  const html = buildDocument(options).toString()
  return writeHtml(res, html, { ...options, csp })
}

function assetToCsp(asset: Html | AssetRef): CspValue {
  if (asset instanceof Html) {
    // Inline assets are "allowed" by their hash
    const hash = createHash('sha256')
    for (const fragment of asset) hash.update(fragment)
    return `'sha256-${hash.digest('base64')}'`
  } else {
    // External assets are referenced by their origin
    if (asset.url.startsWith('https:') || asset.url.startsWith('http:')) {
      return new URL(asset.url).origin as `https:${string}` | `http:${string}`
    }

    // Internal assets are served from the same origin
    return `'self'`
  }
}
