# Changelog

## [0.5.0](https://github.com/JJaeHwan/trellis/compare/v0.4.0...v0.5.0) (2026-05-19)


### Features

* **cmd:** add trellis add command with conflict handling and --force ([8724fbd](https://github.com/JJaeHwan/trellis/commit/8724fbd6386d2d91e6c9c1d3ccaff224de9b5f66))
* **external:** add spec-loader and fragment-types-loader ([7be021a](https://github.com/JJaeHwan/trellis/commit/7be021a763b6eac79ccab32aa2d68603d6fb1f09))
* **scaffold:** write .trellis/spec.json on trellis new ([82cc826](https://github.com/JJaeHwan/trellis/commit/82cc8267b1544be80ed49c01246e0aa1cacada3d))
* **service:** add fragment loader, renderer, and dep-patcher ([2ef869d](https://github.com/JJaeHwan/trellis/commit/2ef869dd13cc40d567e4f394e29d963e912c7d1b))
* **templates:** add b2b-saas and ai-rag-platform fragments (api/page) ([965588d](https://github.com/JJaeHwan/trellis/commit/965588dfa9cf3296c9fe28ea0046b47690f20bc9))

## [0.4.0](https://github.com/JJaeHwan/trellis/compare/v0.3.0...v0.4.0) (2026-04-27)


### Features

* **interview:** add Q10-Q13 (DB feature, auth, LLM scope, embedding) for sharper playbook matching ([7a171a9](https://github.com/JJaeHwan/trellis/commit/7a171a91661a3cadafe252e9c94008748d223be7))

## [0.3.0](https://github.com/JJaeHwan/trellis/compare/v0.2.0...v0.3.0) (2026-04-27)


### Features

* **playbook:** fill out ai-rag-platform skeleton (Next.js + pgvector + LLM/embedder abstractions) ([f37e9b2](https://github.com/JJaeHwan/trellis/commit/f37e9b2c6db12a95cf3dd0625cd6d11806abb826))
* **playbook:** wire ai-rag-platform Session B (upload + multi-doc chat) ([18dfff4](https://github.com/JJaeHwan/trellis/commit/18dfff40f3f9458241b9d0274317b09aec63ce6c))

## [0.2.0](https://github.com/JJaeHwan/trellis/compare/v0.1.0...v0.2.0) (2026-04-27)


### Features

* **playbook:** fill out b2b-saas template (Next.js + Prisma + NextAuth) ([59b05cb](https://github.com/JJaeHwan/trellis/commit/59b05cbcd2d64def590ec920b978b4c9b29a3093))


### Bug Fixes

* **playbook:** b2b-saas template passes real npm install + tsc + lint + next build ([aaaf3bc](https://github.com/JJaeHwan/trellis/commit/aaaf3bcee856d29d47b80047486e2e95188fee64))

## 0.1.0 (2026-04-27)


### Features

* **cmd:** wire 'trellis new' end-to-end and complete P1 ([420e775](https://github.com/JJaeHwan/trellis/commit/420e775a88239266a53812f35c7a57fff9c28349))
* **cmd:** wire scaffold service into 'trellis new' (real file generation) ([ee7913f](https://github.com/JJaeHwan/trellis/commit/ee7913f620fadfa7a56ec6cb544017a41b972365))
* **doctor:** add 'trellis doctor' for documentation/playbook consistency ([e0a05e6](https://github.com/JJaeHwan/trellis/commit/e0a05e6c4307e50e08c7c34e4efafd260c37f6a0))
* **domain:** add interview/playbook/project-spec types and cli-tool playbook spec ([e5eef20](https://github.com/JJaeHwan/trellis/commit/e5eef208076815c02f555a7e1af76e4feef0c301))
* **generator:** add template format spec, generator service, and fs-writer ([5dec599](https://github.com/JJaeHwan/trellis/commit/5dec599bad914158f06f65264f06c4ef54b1fb8a))
* **playbooks:** add b2b-saas + ai-rag-platform, parameterized goldens, E2E test, complete P2 ([30c8c9f](https://github.com/JJaeHwan/trellis/commit/30c8c9f4b9d62fa3be2ea13d8661bd77692b3f2e))
* **release:** add release-please workflow + npm publish metadata ([4455d36](https://github.com/JJaeHwan/trellis/commit/4455d360222fc0ce6a3dde083d19bf33bbd06394))
* scaffold P0 with hello command and CI pipeline ([979791d](https://github.com/JJaeHwan/trellis/commit/979791d47a43a68b4a330e33c2b68c108e053f31))
* **service:** add interview runner and score-based playbook matcher ([abce9e1](https://github.com/JJaeHwan/trellis/commit/abce9e1dcd45a049c942de6b32230341408f29ff))
* **templates:** add cli-tool template tree and template loader ([093692a](https://github.com/JJaeHwan/trellis/commit/093692a07c639affdd66d5642cd680f61f33013a))
* **validator:** add 'trellis check' (TS/JS layer-rule violations) ([145f679](https://github.com/JJaeHwan/trellis/commit/145f67963208ce42beabf6db15d65561d2e0aecf))


### Miscellaneous Chores

* release 0.1.0 ([8178c4a](https://github.com/JJaeHwan/trellis/commit/8178c4abb7b62b9d2ffa7a1bd673f63cada25022))
