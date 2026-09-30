export const FORM_CONSTRAINTS = {
  employee: {
    codeMax: 200,
    nameMax: 200,
    emailMax: 254,
    passwordMin: 8,
    passwordMax: 200,
    deptNameMax: 200,
    positionMax: 200,
  },
  skill: {
    codeMax: 200,
    levelMin: 1,
    levelMax: 10,
    yearsMin: 0,
    noteMax: 3_000,
  },
  career: {
    sheetTextMax: 5_000,
    postingTitleMax: 500,
    requiredSkillsMax: 3_000,
    applicationMessageMax: 3_000,
  },
  grade: {
    codeMax: 100,
    nameMax: 200,
    rankMin: 1,
    rankMax: 9_999,
    descriptionMax: 3_000,
    reasonMax: 3_000,
  },
  position: {
    codeMax: 100,
    nameMax: 200,
    rankMin: 1,
    rankMax: 9_999,
    descriptionMax: 3_000,
  },
  departmentDefinition: {
    nameMax: 200,
  },
  healthCheckup: {
    fiscalYearMin: 2000,
    fiscalYearMax: 2100,
    noteMax: 3_000,
  },
  salaryRevision: {
    baseSalaryMin: 0,
    baseSalaryMax: 100_000_000,
    reasonMax: 3_000,
  },
  goal: {
    periodMax: 100,
    titleMax: 500,
    weightMin: 1,
    weightMax: 100,
    kpiMax: 3_000,
    scoreMin: 0,
    scoreMax: 100,
    commentMax: 3_000,
  },
  oneOnOne: {
    textMax: 5_000,
  },
  survey: {
    titleMax: 500,
    questionsMax: 100,
    answersJsonMax: 10_000,
  },
  review: {
    titleMax: 500,
    periodMax: 100,
    /** YYYY-H1 / YYYY-H2 の評価期間ラベル。API 側の halfYearPeriod と同じ形。 */
    periodPattern: "\\d{4}-H[12]",
    scoreMin: 0,
    scoreMax: 100,
    commentMax: 3_000,
  },
  businessTrip: {
    destinationMax: 500,
    purposeMax: 3_000,
    estimatedCostMin: 0,
  },
  resignation: {
    reasonMax: 3_000,
  },
  lifeEvent: {
    detailMax: 3_000,
  },
  familyCareLeave: {
    leaveKindMax: 200,
    noteMax: 3_000,
  },
} as const
