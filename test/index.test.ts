import t from 'tap'
import * as lib from '../lib'

t.test('import', function (t) {
  t.plan(1)
  t.same(typeof lib, 'object')
})
