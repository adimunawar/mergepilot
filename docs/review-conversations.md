# Review conversation handling

MergePilot can respond when a developer replies to one of its inline review findings.

## GitHub Actions trigger

Add the `pull_request_review_comment` event to the workflow that runs the MergePilot action:

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]
  pull_request_review_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write
```

The token must have permission to read pull request review comments and create replies.

## When MergePilot responds

MergePilot responds only when all of these conditions are met:

- The event is a reply to an existing review comment.
- The parent comment contains MergePilot's stable finding marker.
- The parent comment was authored by a GitHub bot.
- The new comment was not authored by a bot.

Other PR comments, top-level review comments, and replies to human-created review threads are ignored.

## Conversation behavior

MergePilot sends the PR title and description, changed file paths, and the review thread (oldest first) to the configured AI provider. It classifies the response as one of:

- `acknowledge`: accept valid context or a correction from the developer.
- `reconsider`: explain why new context changes the original assessment.
- `explain`: clarify why the original concern still applies.
- `fixed`: acknowledge a claimed fix without claiming it has been independently verified.

The reply is advisory. This feature does not resolve review threads, approve pull requests, request changes, or modify repository code.
