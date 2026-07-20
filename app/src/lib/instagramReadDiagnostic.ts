// Interprets a live "read comments" probe against the connected Instagram
// account. The whole point is to distinguish three outcomes that otherwise look
// identical from the panel:
//   - Standard Access actually returns comments (a compliant poller/notifier is
//     viable with no App Review), vs
//   - the post reports N comments but the API returns 0 (Standard Access hides
//     third-party commenter data — needs Advanced Access / a Live app), vs
//   - inconclusive because the newest post simply has no comments to read.
// Network / egress failures are classified by the caller (they surface as thrown
// errors, not as an empty result), so this stays a pure function.

export type InstagramReadVerdict =
  | "ok"
  | "standard_access_hidden"
  | "inconclusive_no_comments"
  | "no_media";

export interface InstagramReadDiagnosis {
  verdict: InstagramReadVerdict;
  mediaCount: number;
  // comments_count Instagram reports on the newest post (includes replies).
  reportedCommentCount: number | null;
  // comments the /{media-id}/comments endpoint actually returned.
  returnedCommentCount: number | null;
  message: string;
}

export function diagnoseInstagramRead(input: {
  media: Array<{ id: string; comments_count?: number }>;
  // comments returned for the newest post, or null when we didn't get to check.
  newestComments: Array<unknown> | null;
}): InstagramReadDiagnosis {
  const mediaCount = input.media.length;

  if (mediaCount === 0) {
    return {
      verdict: "no_media",
      mediaCount,
      reportedCommentCount: null,
      returnedCommentCount: null,
      message: "У аккаунта нет постов — проверить чтение комментариев не на чем.",
    };
  }

  const reported = input.media[0].comments_count ?? 0;
  const returned = input.newestComments?.length ?? 0;

  if (reported === 0) {
    return {
      verdict: "inconclusive_no_comments",
      mediaCount,
      reportedCommentCount: 0,
      returnedCommentCount: returned,
      message:
        "На последнем посту нет комментариев — результат неоднозначен. Проверьте на посту, под которым точно есть комментарии.",
    };
  }

  if (returned === 0) {
    return {
      verdict: "standard_access_hidden",
      mediaCount,
      reportedCommentCount: reported,
      returnedCommentCount: 0,
      message:
        `Пост сообщает о ${reported} комм., но API вернул 0 — Standard Access скрывает ` +
        "комментарии сторонних пользователей. Нужен Advanced Access и публикация приложения (App Review).",
    };
  }

  return {
    verdict: "ok",
    mediaCount,
    reportedCommentCount: reported,
    returnedCommentCount: returned,
    message:
      `Чтение работает: API вернул ${returned} из ${reported} комм. на последнем посту. ` +
      "Легальный поллер-нотификатор возможен без App Review.",
  };
}
