# @luminarys/sdk-as

AssemblyScript SDK for building Luminarys WASM skills.

## Installation

```bash
npm init -y
npm install --save-dev assemblyscript
npm install @luminarys/sdk-as
```

## Quick Start

Create `assembly/skill.ts` with annotated handler functions:

```ts
import { Context } from "@luminarys/sdk-as";

// @skill:id      com.my-company.my-skill
// @skill:name    "My Skill"
// @skill:version 1.0.0
// @skill:desc    "My first skill."

// @skill:method greet "Greet by name."
// @skill:param  name required "User name"
// @skill:result "Greeting text"
export function greet(_ctx: Context, name: string): string {
  return "Hello, " + name + "!";
}
```

Generate, build, and sign:

```bash
lmsk genkey                            # once: create developer signing key
lmsk generate -lang as assembly/      # generate assembly/lib.ts
npx asc assembly/lib.ts --target release
lmsk sign dist/my-skill.wasm          # → com.my-company.my-skill.skill
```

## Documentation

[luminarys.ai](https://luminarys.ai)

## Tools

Download `lmsk` from [releases](https://github.com/LuminarysAI/luminarys/releases).

## License

MIT
