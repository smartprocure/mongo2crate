import { crate } from '../crate.js'

const conn = crate()

await conn.query('SELECT * FROM doc.agencyData', {
  coltypes: true,
})

await conn.bulkInsert('agencyData', [
  {
    agencyName: 'NC State',
    agencyState: 'North Carolina',
    issuedAmount: 4000,
    issuedDate: '2022-03-21',
  },
  {
    agencyName: 'NC State',
    agencyState: 'North Carolina',
    issuedAmount: 2000,
    issuedDate: '2022-02-21',
  },
])

await conn.insert('foobar', {
  id: '12345',
  name: 'NC State',
  notificationPreferences: ['abc', 'def'],
  integrations: {
    stripe: {
      priceId: 1234,
      subscriptionStatus: 'bla',
    },
  },
})

await conn.upsert(
  'foobar',
  {
    id: '12345',
    name: 'NC State',
    notificationPreferences: ['abc', 'def'],
    integrations: {
      stripe: {
        priceId: 1234,
        subscriptionStatus: 'bla',
      },
    },
  },
  {
    name: 'Fooo',
  }
)
await conn.deleteById('fooBar', '12345')
