# ResearchDino Lab Research Readiness Report

작성일: 2026-07-11

## 1. 결론

ResearchDino Lab은 현재 단순 논문 챗봇이 아니라, 다음 연구 흐름을 표현하고 실행하기 위한 MVP 뼈대를 갖추고 있다.

```text
Project / Lab
    -> Local PDF ingest
    -> Reader evidence extraction
    -> Critic + Librarian review
    -> Strategist + Experiment design
    -> Coordinator synthesis
    -> Human Leader approval
    -> Library
    -> Writing / Experiment follow-up
```

다만 현재 상태를 "완전 자율 연구 시스템"이라고 부르기는 이르다. 지금 실제 연구에 사용할 수 있는 범위는 다음과 같다.

- 사용자 소유 PDF를 대상으로 한 제한적 파일럿
- 각 단계에서 사람이 결과를 확인하는 assisted workflow
- Ollama Cloud가 정상 응답할 때의 Reader 및 Debate orchestration
- 출처와 증거를 확인하면서 가설 후보와 실험계획 초안을 만드는 작업

아직 연구 운영의 핵심인 승인된 지식 검색, 외부 문헌 자동 수집, 반복 토론, 실험 결과의 역류, 장시간 작업 복구가 완성되지 않았다. 따라서 다음 개발의 목표는 화면을 더 꾸미는 것이 아니라 **과학적 추적성, 작업 신뢰성, 반복 가능성**을 확보하는 것이다.

## 2. 현재 구현 상태

| 영역 | 현재 상태 | 실제 사용 판단 |
|---|---|---|
| Laboratory Map / Dashboard | 구현 및 데스크톱 검수 완료 | 운영 화면으로 사용 가능 |
| Project / Lab 기본 스코프 | API 필드와 일부 생성·수정 흐름 구현 | 다중 연구를 위한 기반은 있음 |
| Local PDF ingest | PyMuPDF, 메타데이터, DOI 후보, 페이지·offset trace, 중복 방지 | 제한적 파일럿 가능 |
| Reader 호출 | Ollama `/api/chat`, JSON 검증, AgentRun/Message 저장 | Cloud quota 해소 후 파일럿 가능 |
| Debate 호출 | Critic·Librarian 병렬, Strategist·Experiment 병렬, Coordinator·Leader pre-review | 1회 orchestration MVP |
| Human Leader gate | 승인·반려·재분석·Library 저장 경로 구현 | 핵심 안전장치로 사용 가능 |
| Ollama 모델 배치 | 9개 역할에 Cloud tag 배치, 로컬 등록 완료 | 계정 사용량 확보 필요 |
| Library | 승인 결과를 저장하는 기반은 있음 | 검색 가능한 지식 저장소는 아직 아님 |
| Nature / Science / Elsevier | source registry와 UI만 있음 | 실제 수집·인증·full text ingest 미구현 |
| Strategy / Experiment / Writing | 카드와 일부 model call scaffold 존재 | 실험 실행·결과 검증·원고 export는 미완성 |
| 장시간 작업 운영 | 현재 `POST /agent-actions` 동기 실행 | 실제 수백 편 처리에는 부적합 |

현재 검증된 코드와 미완료 범위는 [milestones.md](./milestones.md)에 기록되어 있다. M7 Library + Retrieval과 M8 Strategy / Experiment / Writing Studio는 아직 시작 전이며, M9는 source registry scaffold 단계다.

## 3. 실제 연구를 수행할 때 필요한 흐름

### 3.1 연구 시작

사용자는 Project를 만든 뒤 연구 질문, 범위, 제외 기준, 대상 기간, 우선 출처, 사용할 Lab 수를 정의해야 한다.

필수 입력:

- 연구 질문과 성공 기준
- 포함·제외할 문헌 기준
- 핵심 용어와 동의어
- 연구별 원문 폴더와 source policy
- 재료·장비·분석법·안전 제약
- 사람이 반드시 승인해야 하는 단계

현재는 Project와 Lab의 표시·스코프 기반은 있지만, 연구 질문과 inclusion/exclusion protocol을 구조화해 저장하는 기능이 부족하다.

### 3.2 문헌 수집

Search는 단순히 PDF 파일을 발견하는 역할이 아니라 다음을 반복해야 한다.

1. 연구 질문을 검색식으로 분해한다.
2. Crossref/OpenAlex/PubMed/arXiv 등에서 후보를 수집한다.
3. DOI, PMID, arXiv ID, publisher ID를 정규화한다.
4. 중복, preprint와 published version, correction, retraction을 확인한다.
5. 사용자가 접근할 수 있는 원문만 로컬에 등록한다.
6. 검색 결과와 제외 이유를 기록한다.

현재는 Local PDF ingest가 이 중 가장 안정적이다. 외부 metadata 검색과 publisher full-text adapter는 아직 없다.

### 3.3 Reader와 증거 추출

Reader의 출력은 요약문보다 다음 항목이 중요하다.

- claim 원문
- claim 유형
- 지지 evidence와 반대 evidence
- 정확한 page, section, character offset
- figure/table/caption 참조
- 연구 설계, 표본 수, controls, effect size, 통계 기준
- 저자가 명시한 limitation
- Reader가 추론한 내용과 원문이 직접 말한 내용을 구분한 라벨

현재 페이지와 character offset은 저장하지만, 모델이 생성한 excerpt가 실제 PDF의 해당 span과 일치하는지 서버가 재검증하는 단계가 필요하다. 이 검증이 없으면 Reader가 그럴듯한 문장을 만들어도 UI에서 source-backed처럼 보일 수 있다.

### 3.4 Debate

실제 Debate는 한 번의 요약 합성이 아니라 다음 순서여야 한다.

```text
Reader evidence
    -> Critic objection
    -> Reader response / source correction
    -> Librarian traceability check
    -> Strategist gap or competing hypothesis
    -> Experiment feasibility challenge
    -> Coordinator synthesis
    -> Leader decision
```

현재 구현은 역할별 fan-out/fan-in과 cross-agent context 전달을 갖춘 1회 토론이다. 연구에 필요한 다음 기능은 아직 부족하다.

- 최소 2~3회의 반론·재반론 라운드
- 각 라운드의 독립적인 agent message 보존
- 반론이 해결되었는지 여부
- unresolved question의 소유자와 다음 작업
- 같은 claim에 대한 여러 논문의 직접 비교
- 토론 종료 조건과 재분석 조건

### 3.5 Leader 승인과 Library

Leader가 승인할 수 있는 것은 단순한 claim 텍스트가 아니라 다음이 연결된 packet이어야 한다.

- source paper와 version
- claim
- supporting/opposing evidence
- critic objection
- unresolved question
- decision criteria
- Leader 판단과 사유
- 다음 단계

승인된 항목만 Library로 이동해야 하며, Library에서 원문 위치까지 다시 이동할 수 있어야 한다. 현재 approval gate의 방향은 맞지만, Library가 검색·비교·재사용되는 지식 시스템으로 완성되지는 않았다.

### 3.6 Strategy와 Experiment

실험계획은 아이디어 문장이 아니라 실행 가능한 protocol draft여야 한다.

- hypothesis와 falsification condition
- independent/dependent variables
- positive, negative, vehicle, sham controls
- sample size와 replicate 정의
- measurement/readout
- 예상 결과와 각 결과의 해석
- failure mode와 troubleshooting
- 장비·재료·시간·예산
- 안전·윤리·기관 승인 필요 여부
- 실험 결과 입력 형식

현재 Experiment는 제안 카드에 가깝다. 실제 연구에 사용하려면 실험자가 계획을 수정하고 승인하고, 실행 결과를 다시 ResearchDino로 넣어 hypothesis와 비교하는 폐루프가 필요하다.

### 3.7 Writing

Writer는 문장을 잘 쓰는 것보다 문장별 출처 상태를 보장해야 한다.

- evidence-linked
- citation-required
- weakly-supported
- unsupported
- needs-user-review

각 문장은 source claim과 evidence에 연결되어야 하고, Library에 없는 지식은 새 사실처럼 쓰면 안 된다. 현재 outline/draft scaffold는 있으나, 실제 citation audit와 DOCX/PDF export를 포함한 manuscript workflow가 부족하다.

## 4. 핵심 부족점과 해결 방안

### P0. 과학적 근거 검증

문제:

- 모델이 만든 excerpt와 실제 PDF span의 일치 여부를 재검증하지 않는다.
- figure, table, supplementary material, OCR이 충분히 다뤄지지 않는다.
- 연구 설계와 통계 품질이 evidence strength에 반영되지 않는다.
- 같은 문헌의 초록·본문·figure를 섞어 잘못된 결론을 만들 수 있다.

해결:

1. `EvidenceVerifier`를 서버에 추가한다.
2. 모든 evidence에 `paperId`, `page`, `section`, `startOffset`, `endOffset`, `excerptHash`를 필수화한다.
3. 서버가 PDF 원문에서 span을 다시 읽고 excerpt와 비교한다.
4. 불일치하면 evidence를 `unverified`로 강등하고 Leader 검토로 보낸다.
5. figure/table/caption/OCR locator를 별도 타입으로 분리한다.
6. 연구 설계, sample size, controls, effect size, CI/p-value, limitation을 `EvidenceAssessment`로 구조화한다.

완료 기준:

- 모델이 만든 claim 중 100%가 원문 위치를 갖는다.
- 불일치 evidence는 Library에 저장되지 않는다.
- UI에서 원문 span을 한 번의 클릭으로 확인할 수 있다.

### P0. Ollama 실행 신뢰성

문제:

- 현재 Agent action은 동기 HTTP 요청이라 Cloud 지연·429·네트워크 단절에 취약하다.
- 계정 quota는 모델 등록과 별개의 문제인데, 현재는 실행 시점에야 알 수 있다.
- 중간 deputy가 성공한 뒤 후속 deputy가 실패하면 전체 상태 복구가 어렵다.

해결:

1. `ResearchRun`과 `AgentJob`을 분리한다.
2. action 요청은 `runId`만 반환하고 worker가 비동기로 실행한다.
3. 단계별 checkpoint를 저장한다.
4. exponential backoff, quota-aware retry, cancellation, resume를 추가한다.
5. prompt, model, temperature, schema version, source snapshot, code version을 run에 저장한다.
6. project/lab별 token budget과 최대 동시 실행 수를 둔다.

완료 기준:

- 서버를 재시작해도 진행 중 run을 잃지 않는다.
- Critic까지만 성공한 Debate를 Librarian부터 재개할 수 있다.
- 429, timeout, invalid JSON, provider unavailable가 각각 구분된다.

### P0. 실제 publisher/source connector

문제:

- Nature, Science / AAAS, Elsevier는 현재 UI source registry일 뿐이다.
- 브라우저에서 account label과 credential reference를 입력해도 실제 backend connector가 생기는 것은 아니다.
- API key와 institutional access를 사용할 안전한 저장소가 없다.

해결:

1. `SourceAdapter` 인터페이스를 만든다.
2. 1단계는 Crossref/OpenAlex 같은 metadata adapter부터 구현한다.
3. 2단계는 Elsevier API 등 공식 API를 credential reference와 함께 연결한다.
4. Nature/Science full text는 기관 접근권과 이용약관을 확인한 뒤 로컬 브라우저 세션 또는 공식 API 방식만 사용한다.
5. secret은 브라우저 state가 아니라 OS keychain 또는 환경변수/secret store에 둔다.
6. 모든 download, access failure, license decision을 audit log로 남긴다.

완료 기준:

- source마다 검색, metadata, abstract, full text capability가 구분된다.
- 권한 없는 full text를 자동으로 우회하지 않는다.
- 동일 DOI의 metadata와 local PDF가 하나의 paper lineage로 합쳐진다.

### P1. Library와 retrieval

문제:

- 승인된 지식을 저장하는 기반은 있지만, 실제 연구자가 검색하고 비교하는 Library가 아니다.
- claim, evidence, paper version, decision, related hypothesis 사이의 탐색이 약하다.
- vector search를 먼저 도입하면 근거 없는 유사도 검색이 될 위험이 있다.

해결:

1. 먼저 SQLite FTS 또는 PostgreSQL full-text search를 구현한다.
2. 기본 검색 결과는 paper, claim, evidence, decision으로 나눈다.
3. 검색 결과마다 source locator와 approval status를 노출한다.
4. exact term, DOI, author, year, project, lab, evidence strength filter를 제공한다.
5. 이후 embeddings를 추가하되, vector hit만으로 claim을 승인하지 않는다.
6. Library entry에 source snapshot과 decision version을 고정한다.

완료 기준:

- 승인된 claim을 검색하면 원문 span과 Leader decision으로 이동한다.
- 같은 topic의 supporting/opposing evidence를 함께 비교할 수 있다.
- provisional output은 기본 Library 검색에 섞이지 않는다.

### P1. 진짜 multi-round Debate

문제:

- 현재 Debate는 여러 역할의 결과를 합성하는 1회 orchestration이다.
- 사용자가 원한 "치열하게 debating"은 반론, 응답, 재검토가 반복되어야 한다.

해결:

1. Debate를 `rounds[]`와 `turns[]`로 저장한다.
2. Critic은 claim마다 objection을 source locator와 함께 제출한다.
3. Reader는 각 objection에 source response 또는 correction을 제출한다.
4. Strategist와 Experiment는 unresolved issue를 각각 hypothesis/test로 변환한다.
5. Coordinator는 해결된 쟁점, 남은 쟁점, 다음 action을 구분한다.
6. Leader는 approve, reject, request-more-evidence, re-run-round 중 하나를 결정한다.

완료 기준:

- 각 주장에 대해 반론과 반론에 대한 답변이 UI에서 시간순으로 보인다.
- unresolved issue가 다음 card와 연결된다.
- Leader가 왜 승인했는지 source-backed decision packet으로 남는다.

### P1. Experiment result loop

문제:

- 현재는 실험을 제안하지만 실제 실행 결과를 받아 hypothesis를 갱신하지 않는다.
- 실패한 실험과 null result가 지식으로 축적되지 않는다.

해결:

1. ExperimentPlan과 ExperimentRun을 분리한다.
2. 계획 승인 후 실행자가 protocol version을 고정한다.
3. 결과를 table/CSV/manual entry로 등록한다.
4. 예상 결과와 실제 결과를 자동 비교한다.
5. 결과가 hypothesis를 support, weaken, falsify, inconclusive 중 무엇인지 판단한다.
6. 결과 packet을 다시 Debate와 Leader gate로 보낸다.

완료 기준:

- 실행 결과 없이 experiment plan이 completed가 되지 않는다.
- null result와 failure mode가 Library에서 검색된다.
- 같은 protocol의 version별 결과를 비교할 수 있다.

### P1. 프로젝트·Lab 운영성

문제:

- `projectId`와 `labId`는 존재하지만, 여러 연구를 오래 운영하기 위한 source folder, queue, budget, output scope가 충분히 분리되지 않았다.
- ingest folder가 단일 active record 중심이라 여러 프로젝트의 폴더를 병렬 관리하기 어렵다.

해결:

1. ingest root를 project/lab별 여러 개 등록한다.
2. 모든 paper, job, source, library entry를 project/lab scope로 강제한다.
3. Same Topic / Split Topics / Independent 모드를 실제 scheduler 설정으로 연결한다.
4. Lab별 model assignment, concurrency, token budget, approval policy를 저장한다.
5. project archive와 lab pause/resume를 추가한다.

완료 기준:

- 적층소재, 우주 연구가 같은 파일명과 claim ID를 써도 섞이지 않는다.
- 한 프로젝트를 pause해도 다른 프로젝트의 run은 계속된다.
- 프로젝트별 cost, queue, evidence count, unresolved issue를 볼 수 있다.

### P2. Writer와 산출물 품질

문제:

- 원고 초안은 Library 승인 지식과 문장 단위로 연결되어야 하지만 현재는 outline scaffold 수준이다.
- DOCX/PDF export, citation audit, version diff가 없다.

해결:

1. 문장별 evidence status를 저장한다.
2. 인용 없는 factual sentence를 자동으로 표시한다.
3. unsupported 문장은 자동 삭제하지 말고 사용자 검토 대상으로 보낸다.
4. Markdown, DOCX, PDF export를 추가한다.
5. manuscript version과 Leader review를 저장한다.

완료 기준:

- 원고의 모든 factual sentence가 source 또는 명시적인 hypothesis label을 가진다.
- 인용 누락·출처 불일치 리포트를 export 전에 확인한다.
- 이전 버전과 변경된 claim을 비교할 수 있다.

## 5. 보안·안전·윤리 요구사항

실제 연구에 사용하려면 다음을 MVP 이후가 아니라 설계 단계부터 반영해야 한다.

- PDF와 웹 원문은 신뢰할 수 없는 입력으로 취급하고 prompt injection을 차단한다.
- 논문 본문에 포함된 지시문이 tool call, 파일 삭제, 외부 전송을 실행하지 못하게 한다.
- 원문, credentials, experiment data를 서로 다른 저장 경계에 둔다.
- local single-user 모드와 multi-user server 모드를 분리한다.
- 사용자 인증, project-level authorization, audit log를 추가한다.
- 생물학·화학·우주·재료 실험은 안전·윤리·기관 승인 여부를 Leader gate에 포함한다.
- Agent는 실험을 자동 실행하지 않고, protocol draft와 approval request만 만든다.
- 고위험 제안은 자동 승인하지 않는다.

## 6. 검증 체계

실제 연구 투입 전에는 모델이 “그럴듯하게 말하는지”가 아니라 다음을 측정해야 한다.

### 데이터셋

- 분야가 다른 실제 논문 20~50편
- claim, evidence, limitation의 사람이 만든 gold annotation
- supporting/opposing evidence가 모두 있는 논문 묶음
- figure/table 중심 논문과 OCR이 필요한 논문
- 중복판, correction, retraction 사례

### 지표

- claim extraction precision / recall
- evidence locator 정확도
- citation coverage
- unsupported claim 비율
- Critic이 발견한 실제 limitation 비율
- Leader 승인 후 반려된 claim 비율
- 동일 논문 반복 실행의 결과 안정성
- 한 논문 처리 시간, token usage, 실패율
- 429/timeout 이후 resume 성공률

### 실패 테스트

- PDF 안에 모델을 조종하는 지시문 삽입
- 잘못된 figure caption과 본문 claim의 충돌
- 같은 DOI의 preprint와 published version 입력
- 빈 PDF, 스캔 PDF, 암호화 PDF
- Cloud quota 소진과 네트워크 단절
- 두 프로젝트가 같은 파일을 동시에 ingest

## 7. 권장 실행 순서

### Phase A: 한 연구를 끝까지 통과시키는 파일럿

- 한 Project, 한 Lab, 논문 5~10편으로 시작
- Ollama quota 또는 사용 가능한 provider 확보
- Reader evidence verifier 구현
- 실제 Reader -> Debate -> Leader approval을 끝까지 실행
- 승인된 claim을 Library에서 다시 검색

### Phase B: Library와 multi-round Debate

- FTS 기반 Library 검색
- claim/evidence comparison
- 2~3 round Debate
- unresolved issue와 follow-up paper 연결
- AgentRun checkpoint/resume

### Phase C: Strategy와 Experiment result loop

- hypothesis scorecard
- protocol과 controls 구조화
- ExperimentRun 및 결과 입력
- 결과를 Debate/Leader로 되돌리는 loop

### Phase D: 외부 출처와 병렬 Lab 확장

- Crossref/OpenAlex metadata adapter
- 공식 publisher API 또는 기관 접근 connector
- project/lab별 ingest roots와 queue
- 2개, 3개 Lab 병렬 실행
- quota, cost, failure dashboard

### Phase E: Writing과 연구 운영 안정화

- sentence-level citation audit
- DOCX/PDF export
- version diff
- access control, secret management, audit log
- 분야별 evaluation set과 regression test

## 8. 첫 번째 실전 파일럿의 통과 조건

다음 질문에 모두 "예"라고 답할 수 있을 때 ResearchDino Lab을 실제 연구 보조 시스템으로 볼 수 있다.

- 논문 한 편의 모든 승인 claim이 원문 page/offset으로 추적되는가?
- 반대 evidence와 limitation이 supporting evidence와 함께 보이는가?
- 모델이 실패하거나 quota가 끝나도 중간 결과를 잃지 않는가?
- Leader가 승인하지 않은 내용이 Library와 Writer에 들어가지 않는가?
- Library에서 승인 claim을 검색해 원문으로 돌아갈 수 있는가?
- 두 개의 연구 Project가 서로의 paper, claim, queue를 침범하지 않는가?
- 실험계획에 controls, replicates, readouts, failure risks가 있는가?
- 원고의 factual sentence가 citation 또는 hypothesis label을 갖는가?
- PDF와 웹 원문에 포함된 악성 지시가 외부 action을 실행하지 못하는가?

이 조건을 통과하기 전까지는 ResearchDino Lab을 "autonomous scientist"가 아니라 **human-gated research orchestration system**으로 정의하는 것이 정확하다.
