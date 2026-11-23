// The owner's answers to an ask of several questions, as one comment: one line per question, each
// written as a quick reply of several questions writes it ("Question → answer"). Older clients post
// each line as its own comment; both read the same way.
import {
  botItemPickedReplies,
  botItemQuestionLine,
  botItemQuickReplyText,
  type BotItemQuestionShape
} from './bot-item-ask'
import { botItemCommentImages } from './bot-items'
import { stripSentImagePromptMarkers } from '../native-chat/transcript/images/native-chat-sent-image-prompt-markers'

/** Per question line, the answer a comment names for it ("Question → answer"), else null. A line
 *  belongs to the question with the longest matching lead, as one question's words may lead another's. */
export function botItemNamedAnswers(shape: BotItemQuestionShape, text: string): (string | null)[] {
  const heads = shape.decisions.map((decision) => `${botItemQuestionLine(decision.question)} →`)
  const answers: (string | null)[] = shape.decisions.map(() => null)
  for (const line of text.split('\n').map((l) => l.trim())) {
    let best = -1
    heads.forEach((head, index) => {
      if (line.startsWith(head) && (best === -1 || head.length > heads[best].length)) {
        best = index
      }
    })
    const words = best === -1 ? '' : line.slice(heads[best].length).trim()
    if (words && answers[best] === null) {
      answers[best] = words
    }
  }
  return answers
}

/** One comment for a set of answers: a line per answered question, in the ask's order; a picked quick
 *  reply writes exactly what its chip posts on its own. */
export function botItemAnswersText(
  shape: BotItemQuestionShape,
  answers: readonly (string | null)[]
): string {
  return shape.decisions
    .flatMap((decision, index) => {
      const words = answers[index]?.replace(/\s+/g, ' ').trim()
      if (!words) {
        return []
      }
      const reply = decision.replies.find((option) => option.label === words)
      return [
        reply
          ? botItemQuickReplyText(shape, decision, reply)
          : `${botItemQuestionLine(decision.question)} → ${words}`
      ]
    })
    .join('\n')
}

/** What an owner's comment answered on one question line, for its "Question → answer" look: the quick
 *  replies it picked, its words for that line, or all its words; null for a recorded answer's words. */
export function botItemAnswerWords(
  shape: BotItemQuestionShape,
  index: number,
  reply: Record<string, unknown>
): string | null {
  const picks = botItemPickedReplies(shape, reply)[index] ?? []
  if (picks.length > 0) {
    return picks.map((pick) => pick.label).join(', ')
  }
  if (Array.isArray(reply.decisions)) {
    return null
  }
  const text = typeof reply.text === 'string' ? reply.text.trim() : ''
  const words = botItemNamedAnswers(shape, text)[index] ?? (text || null)
  // Its images show on its own card, so the [Image #N] its send wrote go; an image alone keeps its mark.
  return (
    words &&
    (stripSentImagePromptMarkers(words, botItemCommentImages(reply).length).trim() || words)
  )
}

/** A ride-along comment: the picks' lines, then the owner's own words, which answer no line. A line of
 *  those words that would read as answering one of the ask's questions ("Question → …") is quoted
 *  ("> "), again until no question's lead matches it, so it can't settle that question unseen; every
 *  other line stays as typed. A lead is finite, so the quoting stops. */
export function botItemRideAlongText(
  shape: BotItemQuestionShape,
  picks: readonly (string | null)[],
  text: string
): string {
  const heads = shape.decisions.map((decision) => `${botItemQuestionLine(decision.question)} →`)
  const rounds = Math.ceil(Math.max(0, ...heads.map((head) => head.length)) / 2) + 1
  const words = text.split('\n').map((line) => {
    let quoted = line
    for (let round = 0; round < rounds; round += 1) {
      const lead = quoted.trim()
      if (!heads.some((head) => lead.startsWith(head))) {
        break
      }
      quoted = `> ${quoted}`
    }
    return quoted
  })
  const answered = botItemAnswersText(shape, picks)
  return answered ? `${answered}\n${words.join('\n')}` : words.join('\n')
}
