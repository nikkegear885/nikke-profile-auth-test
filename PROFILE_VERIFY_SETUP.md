# NIKKE Gear Manager 테스트 사이트 - BlaBlaLink 공개 프로필 동기화

GitHub Pages 테스트 사이트의 공개 프로필 동기화는 Cloudflare Worker `nikke-profile-verify`를 사용합니다. 이 Worker는 서비스용 BlaBlaLink 세션을 갱신하고, 갱신된 쿠키를 Worker 전용 KV에 저장합니다.

## 자동 갱신 방식

- Cloudflare Cron Trigger가 매일 12:00 KST에 세션 갱신을 시도합니다.
- 사용자가 계정 동기화를 누를 때도 갱신을 먼저 시도합니다.
- 갱신 성공 후 받은 쿠키는 `SERVICE_SESSION_KV`에 저장되어 다음 요청에도 이어집니다.
- 만료/폐기된 세션이나 BlaBlaLink 측의 재로그인 요구까지 항상 자동 복구할 수 있는 것은 아닙니다. 갱신 API가 세션을 거부하면 BlaBlaLink에 다시 로그인하여 초기 값을 업데이트해야 합니다.

## 1. KV 네임스페이스 만들기 (한 번만)

Worker 배포 폴더에서 실행합니다.

    npx.cmd wrangler kv namespace create SERVICE_SESSION_KV

명령 결과에 표시된 `id`를 복사합니다. 이 테스트 저장소의 `wrangler.toml`에서 아래 항목의 placeholder를 해당 ID로 바꿉니다.

    [[kv_namespaces]]
    binding = "SERVICE_SESSION_KV"
    id = "여기에_생성된_KV_ID"

KV 네임스페이스를 이미 만들었다면 새로 만들지 말고 기존 ID를 사용합니다.

## 2. 초기 세션 Secret 설정

BlaBlaLink에 로그인된 브라우저의 쿠키 목록에서 **값만** 읽어서 Worker Secret에 저장합니다. 사용자 비밀번호는 필요하지 않습니다. 값은 채팅에 보내거나 GitHub 소스에 작성하지 마세요.

각 명령을 한 번씩 실행하고, Wrangler가 `Enter a secret value`라고 물으면 해당 쿠키의 값을 입력합니다.

    npx.cmd wrangler secret put BLABLALINK_GAME_TOKEN
    npx.cmd wrangler secret put BLABLALINK_GAME_OPENID
    npx.cmd wrangler secret put BLABLALINK_GAME_UID
    npx.cmd wrangler secret put BLABLALINK_GAME_USER_NAME
    npx.cmd wrangler secret put BLABLALINK_GAME_ADULT_STATUS
    npx.cmd wrangler secret put BLABLALINK_GAME_CHANNELID
    npx.cmd wrangler secret put BLABLALINK_GAME_GAMEID

| Worker Secret | BlaBlaLink 쿠키 이름 |
| --- | --- |
| `BLABLALINK_GAME_TOKEN` | `game_token` |
| `BLABLALINK_GAME_OPENID` | `game_openid` |
| `BLABLALINK_GAME_UID` | `game_uid` |
| `BLABLALINK_GAME_USER_NAME` | `game_user_name` |
| `BLABLALINK_GAME_ADULT_STATUS` | `game_adult_status` |
| `BLABLALINK_GAME_CHANNELID` | `game_channelid` |
| `BLABLALINK_GAME_GAMEID` | `game_gameid` |

처음 두 Secret은 이미 설정했다면 다시 입력할 필요가 없습니다. `BLABLALINK_SERVICE_INTL_OPENID`는 새 코드에서 사용하지 않는 기존 호환용 항목입니다.

## 3. Worker 코드 배포

GitHub의 이 테스트 저장소에서 최신 `cloudflare-worker.js`와 `wrangler.toml`을 배포 폴더에 반영하고, `wrangler.toml`의 KV ID가 실제 ID인지 확인합니다. placeholder가 남아 있으면 배포하면 안 됩니다.

그다음 실행합니다.

    npx.cmd wrangler deploy

배포 대상은 `nikke-profile-verify` Worker입니다. 이는 테스트 사이트용 동기화 서버이며, 메인 사이트 파일은 변경하지 않습니다.

## 4. 동작 확인

테스트 사이트에서 강력 새로고침(Ctrl + F5)한 뒤 계정 동기화를 실행합니다. 로그를 확인하려면 별도 PowerShell 창에서 실행합니다.

    npx.cmd wrangler tail nikke-profile-verify

정상적으로 갱신되면 로그에 `scheduled refresh succeeded`가 표시됩니다. 자동 갱신이 실패하면 로그에는 실패 유형만 남기며, 토큰 값은 기록하지 않습니다.

## 보안

- 쿠키와 토큰은 Worker Secret 또는 Worker 전용 KV에만 저장합니다.
- 토큰/쿠키 값을 GitHub에 올리거나 채팅으로 보내지 않습니다.
- 이 갱신은 BlaBlaLink 로그인 갱신 API에 의존하는 실험적인 자동화입니다. 세션이 완전히 만료·폐기되었거나 서비스 정책이 바뀌면 수동 로그인이 필요할 수 있습니다.
