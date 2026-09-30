import { describe, expect, test } from "bun:test"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { InvalidSystemProposalError } from "@system/domain/errors"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"

const accountId = zAccountId.parse("d5858208-e680-4db8-a05d-8bf4f900c24e")

describe("ProcedureDefinitionEntity", () => {
  test("入力契約と判断方針をcanonical JSONへ固定する", () => {
    const definition = ProcedureDefinitionEntity.create({
      key: "change",
      revision: 1,
      title: "Change",
      category: "operation",
      description: null,
      inputSchema: { required: ["reason"], type: "object" },
      decisionPolicy: { steps: [{ key: "review", owner: "authority" }] },
      completionOperationKey: "apply-change",
      createdByAccountId: accountId,
      createdAt: new Date(100),
    })

    expect(definition).toBeInstanceOf(ProcedureDefinitionEntity)
    if (!(definition instanceof ProcedureDefinitionEntity)) return
    expect(definition.inputSchemaJson).toBe('{"required":["reason"],"type":"object"}')
    expect(definition.decisionPolicyJson).toBe('{"steps":[{"key":"review","owner":"authority"}]}')
  })

  test("不正なkeyと時刻を拒否する", () => {
    const definition = ProcedureDefinitionEntity.create({
      key: "Invalid Key",
      revision: 1,
      title: "Change",
      category: "operation",
      description: null,
      inputSchema: {},
      decisionPolicy: {},
      completionOperationKey: null,
      createdByAccountId: accountId,
      createdAt: new Date(Number.NaN),
    })

    expect(definition).toBeInstanceOf(InvalidSystemProposalError)
  })
})
