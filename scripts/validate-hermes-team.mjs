import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const profiles = [
  'raisesea-news-intelligence',
  'raisesea-social-media-manager',
  'raisesea-software-engineer',
  'raisesea-chief-of-staff',
]
const skills = [
  'raisesea_knowledge', 'raisesea_handoff', 'idea_save', 'task_add',
  'team_status', 'content_draft', 'content_plan', 'engineering_plan',
  'engineering_status',
]

const errors = []
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

for (const profile of profiles) {
  const file = `hermes/profiles/${profile}/SOUL.md`
  if (!fs.existsSync(path.join(root, file))) errors.push(`missing ${file}`)
}

for (const skill of skills) {
  const file = `hermes/skills/${skill}/SKILL.md`
  if (!fs.existsSync(path.join(root, file))) {
    errors.push(`missing ${file}`)
    continue
  }
  const body = read(file)
  if (!body.startsWith('---\n')) errors.push(`${file}: missing YAML frontmatter`)
  if (!body.includes(`\nname: ${skill}\n`)) errors.push(`${file}: name must match directory`)
  if (!/\ndescription: .+\n---\n/.test(body)) errors.push(`${file}: missing description`)
}

const knowledgeFiles = fs.readdirSync(path.join(root, 'knowledge'), { recursive: true })
  .filter(file => file.endsWith('.md'))
for (const file of knowledgeFiles) {
  const rel = path.join('knowledge', file)
  const body = read(rel)
  const secretPattern = /(sk-[A-Za-z0-9_-]{20,}|bot\d{6,}:[A-Za-z0-9_-]{20,}|BEGIN (RSA|OPENSSH|EC) PRIVATE KEY)/
  if (secretPattern.test(body)) errors.push(`${rel}: possible secret`)
}

const menu = read('hermes/team-command-menu.yaml.example')
for (const command of ['idea_save', 'task_add', 'team_status', 'content_draft', 'engineering_plan']) {
  if (!menu.includes(`- ${command}`)) errors.push(`command menu missing ${command}`)
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`Hermes team validation passed: ${profiles.length} profiles, ${skills.length} shared/role skills.`)
