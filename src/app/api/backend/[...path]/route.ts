import { NextRequest, NextResponse } from 'next/server'

/**
 * API Proxy Route Handler for Next.js App Router.
 * Forwards requests from /api/backend/* to the target Fastify backend.
 * Expects environment variable: BACKEND_URL (e.g., https://continuum-api.onrender.com)
 */

function getBackendBaseUrl(): string {
  const url =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001'
  return url.replace(/\/+$/, '')
}

async function proxyRequest(
  req: NextRequest,
  { params }: { params: { path?: string[] } }
) {
  try {
    const baseUrl = getBackendBaseUrl()
    const pathSegments = params.path ?? []
    const subpath = pathSegments.join('/')
    const search = req.nextUrl.search || ''
    const targetUrl = `${baseUrl}/${subpath}${search}`

    // Copy incoming headers except host, connection, content-length, expect
    const headers = new Headers()
    req.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase()
      if (
        lowerKey !== 'host' &&
        lowerKey !== 'connection' &&
        lowerKey !== 'content-length' &&
        lowerKey !== 'expect'
      ) {
        headers.set(key, value)
      }
    })

    const method = req.method
    let body: any = undefined

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const contentType = req.headers.get('content-type') || ''
      if (contentType.includes('multipart/form-data')) {
        body = await req.formData()
        headers.delete('content-type')
      } else {
        const text = await req.text()
        if (text && text.length > 0) {
          body = text
        }
      }
    }

    const initOptions: any = {
      method,
      headers,
    }
    if (body !== undefined) {
      initOptions.body = body
      initOptions.duplex = 'half'
    }

    const backendRes = await fetch(targetUrl, initOptions)

    // Build response headers
    const resHeaders = new Headers()
    backendRes.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase()
      if (
        lowerKey !== 'transfer-encoding' &&
        lowerKey !== 'content-encoding'
      ) {
        resHeaders.set(key, value)
      }
    })

    return new Response(backendRes.body, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: resHeaders,
    })
  } catch (err: any) {
    console.error('API Proxy Error:', err)
    return NextResponse.json(
      {
        error: 'Proxy Error',
        message: err?.message || 'Failed to reach backend service',
        backendUrl: getBackendBaseUrl(),
      },
      { status: 502 }
    )
  }
}

export async function GET(
  req: NextRequest,
  context: { params: { path?: string[] } }
) {
  return proxyRequest(req, context)
}

export async function POST(
  req: NextRequest,
  context: { params: { path?: string[] } }
) {
  return proxyRequest(req, context)
}

export async function PUT(
  req: NextRequest,
  context: { params: { path?: string[] } }
) {
  return proxyRequest(req, context)
}

export async function PATCH(
  req: NextRequest,
  context: { params: { path?: string[] } }
) {
  return proxyRequest(req, context)
}

export async function DELETE(
  req: NextRequest,
  context: { params: { path?: string[] } }
) {
  return proxyRequest(req, context)
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
