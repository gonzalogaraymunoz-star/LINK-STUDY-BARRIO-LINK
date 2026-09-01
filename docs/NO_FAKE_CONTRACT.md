# Truth & No Fake Contract

A visible function must complete this chain:

`real input → validation → execution → persistence → UI refresh → audit`

Rules:

1. Missing context remains missing.
2. Connection status is displayed only after a real health check.
3. Simulation is never rendered as operational fact.
4. Findings always carry a truth class.
5. Every context snapshot keeps provenance and a digest.
6. MiroFish controls remain hidden when MiroFish is not reachable.
7. Secrets remain server-side.
8. Study writes are isolated from operational tables.
9. Any future action that changes an operational business must be a separate, explicit, authorized workflow outside the study engine.
