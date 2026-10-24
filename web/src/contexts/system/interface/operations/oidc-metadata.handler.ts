import { OidcScopeValue } from "@system/domain/values/oauth/oidc-scope.value"
import { oidcSigningAlgorithm } from "@system/domain/values/oauth/oidc-signing-algorithm.value"
import type { OidcIssuerConfigurationValue } from "@system/domain/values/oauth/oidc-issuer-configuration.value"
import { getOidcPublicKeys } from "@system/application/auth/identity/lib/get-oidc-public-keys"
import { parseOidcSigningKeys } from "@system/application/auth/identity/lib/parse-oidc-signing-keys"
import {
  OIDCMetadataNotFoundError,
  OIDCMethodNotAllowedError,
  OIDCTemporarilyUnavailableError,
} from "@/contexts/system/interface/errors"

const DISCOVERY_PATH = "/.well-known/openid-configuration"
const JWKS_PATH = "/.well-known/jwks.json"

const PUBLIC_METADATA_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=300",
  "Content-Type": "application/json; charset=UTF-8",
} as const

type Props = Readonly<{
  request: Request
  signingKeysRaw: string | undefined
  issuerConfiguration: OidcIssuerConfigurationValue
}>

export function handleOidcMetadataRequest(props: Props): Response | null {
  const pathname = new URL(props.request.url).pathname
  if (pathname !== DISCOVERY_PATH && pathname !== JWKS_PATH) {
    return null
  }

  if (props.request.method !== "GET" && props.request.method !== "HEAD") {
    throw new OIDCMethodNotAllowedError()
  }

  const issuer = props.issuerConfiguration.resolve({
    requestUrl: props.request.url,
    forwardedHost: props.request.headers.get("X-Forwarded-Host"),
  })
  if (issuer instanceof Error) {
    throw new OIDCMetadataNotFoundError(issuer)
  }

  const signingKeys = parseOidcSigningKeys(props.signingKeysRaw)
  if (signingKeys instanceof Error) {
    console.error("OIDC signing keys are not configured")
    throw new OIDCTemporarilyUnavailableError(signingKeys)
  }

  if (pathname === JWKS_PATH) {
    return new Response(
      props.request.method === "HEAD"
        ? null
        : JSON.stringify({ keys: getOidcPublicKeys(signingKeys) }),
      { headers: PUBLIC_METADATA_HEADERS },
    )
  }

  const metadata = {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,
    userinfo_endpoint: `${issuer}/api/oauth/userinfo`,
    jwks_uri: `${issuer}${JWKS_PATH}`,
    scopes_supported: OidcScopeValue.supported().items,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: [oidcSigningAlgorithm.toString()],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    authorization_response_iss_parameter_supported: true,
    claims_supported: [
      "sub",
      "iss",
      "aud",
      "exp",
      "iat",
      "nonce",
      "name",
      "email",
      "email_verified",
    ],
  }
  return new Response(props.request.method === "HEAD" ? null : JSON.stringify(metadata), {
    headers: PUBLIC_METADATA_HEADERS,
  })
}
