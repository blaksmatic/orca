import { beforeEach, describe, expect, it, vi } from 'vitest'
import { structuredAgentSessionPayloadFingerprint } from '../../../shared/structured-agent-session-mutation'
import { callStructuredAgentSession } from '@/runtime/structured-agent-session-client'
import { RuntimeRpcCallError } from '@/runtime/runtime-rpc-client'
import { peekWebSessionFocusIntent } from '@/runtime/web-session-focus-intent'
import { LOCAL_STRUCTURED_SESSION_OWNER } from '@/runtime/local-structured-session-tabs-sync'
import {
  createStructuredCodexSessionLaunchIntent,
  launchStructuredCodexSession,
  StructuredAgentSessionCreateRefusalError,
  StructuredAgentSessionCreateUnknownOutcomeError
} from './launch-structured-codex-session'

vi.mock('@/runtime/structured-agent-session-client', () => ({
  callStructuredAgentSession: vi.fn()
}))

describe('structured Codex launch', () => {
  beforeEach(() => {
    vi.mocked(callStructuredAgentSession).mockReset()
  })

  it('creates a native session with a host-verifiable launch intent', async () => {
    vi.mocked(callStructuredAgentSession).mockImplementation(async (_target, _method, params) => ({
      ok: true,
      replayed: false,
      fence: 1,
      cursor: { epoch: 'epoch-1', sequence: 0 },
      value: {
        sessionId: (params as { envelope: { sessionId: string } }).envelope.sessionId,
        fence: 1,
        page: {
          sessionId: 'session-1',
          epoch: 'epoch-1',
          direction: 'tail',
          items: [],
          removedItemIds: [],
          submissions: [],
          window: {
            oldest: null,
            newest: null,
            nextCursor: { epoch: 'epoch-1', sequence: 0 }
          },
          liveCursor: { epoch: 'epoch-1', sequence: 0 },
          hasOlder: false,
          hasNewer: false
        },
        unconfirmedClientMessageIds: []
      }
    }))

    const intent = createStructuredCodexSessionLaunchIntent('workspace-1')
    const receipt = await launchStructuredCodexSession(intent)
    const params = vi.mocked(callStructuredAgentSession).mock.calls[0]?.[2] as {
      envelope: { sessionId: string; payloadFingerprint: string }
      worktree: string
      agent: 'codex'
    }

    expect(receipt).toEqual({
      sessionId: expect.stringMatching(/^codex_[A-Za-z0-9_]{36}$/),
      fence: 1
    })
    expect(callStructuredAgentSession).toHaveBeenCalledWith(
      { kind: 'local' },
      'agentSession.create',
      expect.objectContaining({ worktree: 'id:workspace-1', agent: 'codex' })
    )
    expect(params.envelope.payloadFingerprint).toBe(
      structuredAgentSessionPayloadFingerprint({
        method: 'agentSession.create',
        sessionId: params.envelope.sessionId,
        fields: { worktree: 'id:workspace-1', agent: 'codex' }
      })
    )
    expect(params).toBe(intent.params)
  })

  it('replays the exact create envelope when an unknown outcome is retried', async () => {
    const intent = createStructuredCodexSessionLaunchIntent('workspace-retry')
    vi.mocked(callStructuredAgentSession).mockRejectedValue(new Error('response lost'))

    await expect(launchStructuredCodexSession(intent)).rejects.toThrow('response lost')
    await expect(launchStructuredCodexSession(intent)).rejects.toThrow('response lost')

    const first = vi.mocked(callStructuredAgentSession).mock.calls[0]?.[2]
    const second = vi.mocked(callStructuredAgentSession).mock.calls[1]?.[2]
    expect(first).toBe(intent.params)
    expect(second).toBe(first)
    expect(intent.params.envelope.clientOperationId).toMatch(/^\d{13}-[0-9a-f]{32}$/)
  })

  it('refuses definitively only on an allowlisted code, and carries it', async () => {
    const intent = createStructuredCodexSessionLaunchIntent('workspace-unsupported')
    vi.mocked(callStructuredAgentSession).mockResolvedValue({
      ok: false,
      refusal: {
        code: 'structured_agent_session_unsupported',
        message: 'Orca cannot open a structured Codex chat for this workspace.'
      }
    })

    const error = await launchStructuredCodexSession(intent).catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(StructuredAgentSessionCreateRefusalError)
    expect((error as StructuredAgentSessionCreateRefusalError).code).toBe(
      'structured_agent_session_unsupported'
    )
    expect(
      peekWebSessionFocusIntent(
        { environmentId: LOCAL_STRUCTURED_SESSION_OWNER },
        'workspace-unsupported'
      )
    ).toBeNull()
  })

  it('classifies a thrown method-not-found RPC failure as definitive', async () => {
    const intent = createStructuredCodexSessionLaunchIntent('workspace-old-runtime')
    vi.mocked(callStructuredAgentSession).mockRejectedValue(
      new RuntimeRpcCallError({
        id: 'rpc-old-runtime',
        ok: false,
        error: { code: 'method_not_found', message: 'Unknown method: agentSession.create' }
      })
    )

    const error = await launchStructuredCodexSession(intent).catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(StructuredAgentSessionCreateRefusalError)
    expect((error as StructuredAgentSessionCreateRefusalError).code).toBe('method_not_found')
    expect(
      peekWebSessionFocusIntent(
        { environmentId: LOCAL_STRUCTURED_SESSION_OWNER },
        'workspace-old-runtime'
      )
    ).toBeNull()
  })

  it('does not trust method-not-found text without the dispatcher code', async () => {
    const intent = createStructuredCodexSessionLaunchIntent('workspace-ambiguous-error')
    const failure = new Error('method_not_found')
    vi.mocked(callStructuredAgentSession).mockRejectedValue(failure)

    await expect(launchStructuredCodexSession(intent)).rejects.toBe(failure)
    expect(
      peekWebSessionFocusIntent(
        { environmentId: LOCAL_STRUCTURED_SESSION_OWNER },
        'workspace-ambiguous-error'
      )
    ).toEqual(expect.objectContaining({ hostTabId: `agent-session:${intent.sessionId}` }))
  })

  it.each(['runtime_timeout', 'remote_runtime_unavailable'])(
    'keeps a thrown %s RPC failure unknown',
    async (code) => {
      const worktreeId = `workspace-${code}`
      const intent = createStructuredCodexSessionLaunchIntent(worktreeId)
      const failure = new RuntimeRpcCallError({
        id: `rpc-${code}`,
        ok: false,
        error: { code, message: 'The create result could not be confirmed.' }
      })
      vi.mocked(callStructuredAgentSession).mockRejectedValue(failure)

      await expect(launchStructuredCodexSession(intent)).rejects.toBe(failure)
      expect(
        peekWebSessionFocusIntent({ environmentId: LOCAL_STRUCTURED_SESSION_OWNER }, worktreeId)
      ).toEqual(expect.objectContaining({ hostTabId: `agent-session:${intent.sessionId}` }))
    }
  )

  it.each(['agent_session_operation_unknown', 'agent_session_ownership_unknown'])(
    'leaves %s unknown rather than definitively refused',
    async (code) => {
      const worktreeId = `workspace-${code}`
      const intent = createStructuredCodexSessionLaunchIntent(worktreeId)
      vi.mocked(callStructuredAgentSession).mockResolvedValue({
        ok: false,
        refusal: { code, message: 'The Codex chat could not be confirmed.' }
      })

      const error = await launchStructuredCodexSession(intent).catch((thrown: unknown) => thrown)

      expect(error).toBeInstanceOf(StructuredAgentSessionCreateUnknownOutcomeError)
      expect(error).not.toBeInstanceOf(StructuredAgentSessionCreateRefusalError)
      expect((error as StructuredAgentSessionCreateUnknownOutcomeError).code).toBe(code)
      // The session may exist; the focus intent has to survive so recovery can adopt its tab.
      expect(
        peekWebSessionFocusIntent({ environmentId: LOCAL_STRUCTURED_SESSION_OWNER }, worktreeId)
      ).toEqual(expect.objectContaining({ hostTabId: `agent-session:${intent.sessionId}` }))
    }
  )
})
