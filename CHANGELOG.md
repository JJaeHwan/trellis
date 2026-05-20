# Changelog

## [0.11.0](https://github.com/JJaeHwan/trellis/compare/v0.10.0...v0.11.0) (2026-05-20)


### Features

* **cmd:** add 'trellis upgrade' command ([6c3bf02](https://github.com/JJaeHwan/trellis/commit/6c3bf025328edbbe9c3934e338681d3bccce0897))
* **doctor:** add upgrade-pending rule ([111472c](https://github.com/JJaeHwan/trellis/commit/111472cb5024eb87973514ea9519e06fae9a2eda))
* **upgrader:** introduce trellis upgrade service + migration manifest system ([76984dc](https://github.com/JJaeHwan/trellis/commit/76984dc00487adb38ffa9165ba0735da194a2063))

## [0.10.0](https://github.com/JJaeHwan/trellis/compare/v0.9.0...v0.10.0) (2026-05-19)


### Features

* **cmd:** add 'trellis list' command for fragment discovery ([aec9d2b](https://github.com/JJaeHwan/trellis/commit/aec9d2be49bc0c647cec14ca1b4469065d266956))
* **doctor:** add playbook-still-supported rule ([38e6dee](https://github.com/JJaeHwan/trellis/commit/38e6dee8a81c4c6c23eaf025e7d2a63749a6ef32))
* expand actionable hints across HarnessError sites ([fd60727](https://github.com/JJaeHwan/trellis/commit/fd607270d30ae51a70545bd0ff150204173ed88d))
* **playbook:** add command + service-module fragments to cli-tool ([cf3ee60](https://github.com/JJaeHwan/trellis/commit/cf3ee6024c1de7f2f4c8d64f5594d591e4b92727))
* **playbook:** add imports + commands slots to cli-tool fullbody ([8d4e00c](https://github.com/JJaeHwan/trellis/commit/8d4e00c21d1b57dffd84487fdd02382cf70c2aa3))


### Bug Fixes

* **ci:** scope release-please to single package with empty component ([9c32fa4](https://github.com/JJaeHwan/trellis/commit/9c32fa4026b385527844e8b895b9c7cba8732a44))

## [0.9.0](https://github.com/JJaeHwan/trellis/compare/v0.8.0...v0.9.0) (2026-05-19)


### Features

* **cmd:** add --json output to trellis new ([d1141cc](https://github.com/JJaeHwan/trellis/commit/d1141cc03416219f486dc14d4156167ee63fc9c2))
* **doctor:** add handlebars-token-valid rule ([a371cc9](https://github.com/JJaeHwan/trellis/commit/a371cc9eff464a7b426b1e5c4594322768b845f5))
* **fragment:** add hint to patcher slot-missing error ([f2b1b3e](https://github.com/JJaeHwan/trellis/commit/f2b1b3e4becd2367064c5487f048a43c9129567d))
* **playbook:** add admin-items + breadcrumb slot infrastructure (b2b-saas) ([36825ca](https://github.com/JJaeHwan/trellis/commit/36825cad6471ff5d8b7a93f71176ba1176616a54))
* **playbook:** add dependency-cruiser config to b2b-saas fullbody ([beeef21](https://github.com/JJaeHwan/trellis/commit/beeef21d1aaa9628f8eca079180e41e0b7289338))
* **playbook:** add form + admin fragments with multi-slot patches (b2b-saas) ([ce02c23](https://github.com/JJaeHwan/trellis/commit/ce02c23019dd048229ee7bb2d36d8bbd35869685))

## [0.8.0](https://github.com/JJaeHwan/trellis/compare/v0.7.0...v0.8.0) (2026-05-19)


### Features

* **cmd:** add --json output and actionable hints to trellis add ([a44e6cc](https://github.com/JJaeHwan/trellis/commit/a44e6cccbc9f774f905b78711d50bc20a8c3497d))
* **common:** add hint field to HarnessError for actionable suggestions ([e8aa9bc](https://github.com/JJaeHwan/trellis/commit/e8aa9bc3f8b77fa4453884ecc35c29571bd78867))
* **doctor:** add trellis-version-compat rule ([1191075](https://github.com/JJaeHwan/trellis/commit/1191075909c5e7f056b82d49b5566fbe8db4513b))
* **playbook:** add model + service fragments with multi-slot patches (b2b-saas) ([3d4a913](https://github.com/JJaeHwan/trellis/commit/3d4a9139ffe6f5d2813ec322eb44429653ad8289))
* **playbook:** inject prisma-models + services slot markers in b2b-saas fullbody ([599a017](https://github.com/JJaeHwan/trellis/commit/599a017889ece0d31639a059738deafa7f1d011b))

## [0.7.0](https://github.com/JJaeHwan/trellis/compare/v0.6.0...v0.7.0) (2026-05-19)


### Features

* **cmd:** wire applyPatches into trellis add with --verbose ([a07d27d](https://github.com/JJaeHwan/trellis/commit/a07d27d36d8be84baf31163e16ee7a9ec95461b3))
* **doctor:** add patch-marker-presence rule ([5cda57c](https://github.com/JJaeHwan/trellis/commit/5cda57c826f0a72e920e37d66180fe611fff11d5))
* **fragment:** add PatchDecl type, loader parsing, and patcher service ([0abf1b3](https://github.com/JJaeHwan/trellis/commit/0abf1b35a293fb4bbb51f5c27c1e4141ba8bb030))
* **playbook:** inject nav-items markers and declare patches in page fragments ([edd769a](https://github.com/JJaeHwan/trellis/commit/edd769a61c8ab1eea98993cb1f3fc0d3c44f898d))

## [0.6.0](https://github.com/JJaeHwan/trellis/compare/v0.5.0...v0.6.0) (2026-05-19)


### Features

* **playbook:** add sidebar and (authed) layout to b2b-saas fullbody ([41ee2e1](https://github.com/JJaeHwan/trellis/commit/41ee2e13548234354837aab19ddae6051beac127))
* **playbook:** add sidebar to ai-rag-platform fullbody ([9911092](https://github.com/JJaeHwan/trellis/commit/9911092cc93f55ea81daceb14b5ac28c02bb3812))

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
