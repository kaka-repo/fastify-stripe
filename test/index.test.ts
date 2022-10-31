import Fastify from 'fastify'
import t from 'tap'
import plugin from '../lib'

t.test('invalid api key - no option', function (t) {
  t.plan(1)
  const fastify = Fastify()
  t.rejects(async () => {
    await fastify.register(plugin)
  })
})

const invalid = [
  0,
  true,
  undefined,
  null,
  {},
  []
]

for (const apiKey of invalid) {
  t.test(`invalid api key - ${typeof apiKey}`, function (t) {
    t.plan(1)
    const fastify = Fastify()
    t.rejects(async () => {
    // @ts-expect-error
      await fastify.register(plugin, { apiKey })
    })
  })
}
