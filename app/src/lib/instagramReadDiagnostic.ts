// Interprets a live "read comments" probe against the connected Instagram
// account. The whole point is to distinguish three outcomes that otherwise look
// identical from the panel:
//   - Standard Access returns comments (a compliant poller/notifier is viable
//     with no App Review), vs
//   - the post reports N comments but the API returns 0 (Standard Access hides
//     third-party commenter data — needs Advanced Access / a Live app), vs
//   - inconclusive because no post has any comments to read.
// Network / egress failures are classified by the caller (they surface as thrown
// errors, not as an empty result), so this stays a pure function.

export type InstagramReadVerdict =
  | "ok"
  | "standard_access_hidden"
  | "inconclusive_no_comments"
  | "no_media";

export interface ProbeMedia {
  id: string;
  comments_count?: number;
  permalink?: string;
}

export interface InstagramReadDiagnosis {
  verdict: InstagramReadVerdict;
  mediaCount: number;
  // comments_count Instagram reports on the probed post (includes replies).
  reportedCommentCount: number | null;
  // comments the /{media-id}/comments endpoint actually returned.
  returnedCommentCount: number | null;
  message: string;
}

// Pick the newest post that actually has comments, so the probe is conclusive
// instead of landing on a comment-less latest post. listMedia returns posts
// newest-first, and comments_count comes back with each post, so this needs no
// extra API calls — only the chosen post is then queried for its comments.
export function pickProbeMedia<T extends { comments_count?: number }>(media: T[]): T | null {
  return media.find((m) => (m.comments_count ?? 0) > 0) ?? null;
}

export function diagnoseInstagramRead(input: {
  mediaCount: number;
  probeMedia: ProbeMedia | null;
  // comments returned for the probed post, or null when there was nothing to probe.
  probeComments: Array<unknown> | null;
}): InstagramReadDiagnosis {
  const { mediaCount, probeMedia, probeComments } = input;

  if (mediaCount === 0) {
    return {
      verdict: "no_media",
      mediaCount,
      reportedCommentCount: null,
      returnedCommentCount: null,
      message: "У аккаунта нет постов — проверить чтение комментариев не на чем.",
    };
  }

  if (!probeMedia) {
    return {
      verdict: "inconclusive_no_comments",
      mediaCount,
      reportedCommentCount: 0,
      returnedCommentCount: 0,
      message:
        `Ни под одним из постов (${mediaCount}) нет комментариев — проверять нечего. ` +
        "Оставьте тестовый комментарий под любым постом и повторите проверку.",
    };
  }

  const reported = probeMedia.comments_count ?? 0;
  const returned = probeComments?.length ?? 0;

  if (returned === 0) {
    return {
      verdict: "standard_access_hidden",
      mediaCount,
      reportedCommentCount: reported,
      returnedCommentCount: 0,
      message:
        `Проверенный пост сообщает о ${reported} комм., но API вернул 0 — Standard Access ` +
        "скрывает комментарии сторонних пользователей. Нужен Advanced Access и публикация приложения (App Review).",
    };
  }

  return {
    verdict: "ok",
    mediaCount,
    reportedCommentCount: reported,
    returnedCommentCount: returned,
    message:
      `Чтение работает: API вернул ${returned} из ${reported} комм. на проверенном посту. ` +
      "Легальный поллер-нотификатор возможен без App Review.",
  };
}
