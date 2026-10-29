type Props = Readonly<{
  baseUrl: string
  failedToken: string | null
  consumedRefreshTokens: Map<string, string>
  readTokens: (baseUrl: string) => Promise<{ token: string | null; refresh_token: string | null }>
  rotate: (
    baseUrl: string,
    refreshToken: string,
  ) => Promise<{
    access_token: string
    refresh_token: string | null
  } | null>
  saveTokens: (baseUrl: string, accessToken: string, refreshToken: string | null) => Promise<void>
  updateToken: (token: string) => void
}>

/** 遅れて届いた401には保存済みの後継を使い、保存不能なrotationを成功扱いしない。 */
export async function refreshCurrentToken(props: Props): Promise<string | null> {
  const tokens = await props.readTokens(props.baseUrl)

  if (
    tokens.refresh_token !== null &&
    props.consumedRefreshTokens.get(props.baseUrl) === tokens.refresh_token
  )
    return null

  if (tokens.token !== null && tokens.token !== props.failedToken) {
    props.updateToken(tokens.token)
    return tokens.token
  }
  if (tokens.refresh_token === null) return null

  const rotated = await props.rotate(props.baseUrl, tokens.refresh_token)

  if (rotated === null) return null

  props.consumedRefreshTokens.set(props.baseUrl, tokens.refresh_token)
  props.updateToken(rotated.access_token)
  await props.saveTokens(props.baseUrl, rotated.access_token, rotated.refresh_token)

  return rotated.access_token
}
