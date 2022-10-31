import { FastifyPluginAsync } from 'fastify'
import FastifyPlugin from 'fastify-plugin'
import { Stripe } from 'stripe'

const Plugin: FastifyPluginAsync<FastifyStripeOptions> = async function (fastify, options) {
  let stripe: Stripe
  if (options.stripe instanceof Stripe) {
    stripe = options.stripe
  } else {
    if (typeof options.apiKey !== 'string') throw Error(`options.apiKey expected to be "string", but recieved "${typeof options.apiKey}"`)
    if (typeof options.stripe !== 'object' || options.stripe === null) throw Error(`options.stripe expected to be "object", but recieved "${options.stripe === null ? 'null' : typeof options.stripe}"`)
    stripe = new Stripe(options.apiKey, options.stripe)
  }

  fastify.decorate('stripe', stripe)

  // we provide some tools
  function setApiKey (apiKey: string): Stripe {
    if (typeof apiKey !== 'string') throw Error(`apiKey expected to be "string", but recieved "${typeof apiKey}"`)
    // we cannot update when provided Stripe instance
    if (options.stripe instanceof Stripe) return fastify.stripe
    // when we reach this function, options.stripe already validated
    stripe = new Stripe(apiKey, options.stripe as Stripe.StripeConfig)
    fastify.stripe = stripe
    return stripe
  }

  async function ensureCustomer (customerId: string | undefined, params: Stripe.CustomerCreateParams, querydata?: CustomerQuery): Promise<Stripe.Customer> {
    if (typeof customerId !== 'string') {
      return await stripe.customers.create(params)
    } else {
      // check if customer exist
      try {
        const customer = await stripe.customers.retrieve(customerId)
        if (customer.deleted) throw Error(`Customer - ${customerId} was marked as deleted.`)
        // we update metadata for old customer
        if (typeof params.metadata === 'object') {
          return await stripe.customers.update(customerId, { metadata: params.metadata })
        } else {
          return customer
        }
      } catch {
        if (typeof querydata === 'object') {
          let query = `${querydata.field}~"${String(params[querydata.field])}"`
          if (typeof querydata.metadata === 'object') {
            const keys = Object.keys(querydata.metadata)
            for (const key of keys) {
              query = `${query} AND metadata["${key}"]:"${querydata.metadata[key]}"`
            }
          }
          // we find if there are record for different environment
          const result = await stripe.customers.search({ query })
          if (result.data.length > 0) {
            return result.data[0]
          } else {
            return await stripe.customers.create(params)
          }
        } else {
          return await stripe.customers.create(params)
        }
      }
    }
  }

  const stripeTools = Object.create(null)
  stripeTools.ensureCustomer = ensureCustomer
  stripeTools.setApiKey = setApiKey

  fastify.decorate('stripeTools', stripeTools)
}

export const fastifyStripe = FastifyPlugin(Plugin, {
  fastify: '4.x',
  name: '@kakang/fastify-stripe',
  dependencies: []
})
export default fastifyStripe

declare module 'fastify' {
  interface FastifyInstance {
    stripe: Stripe
    stripeTools: StripeTools
  }
}

export interface FastifyStripeOptions {
  apiKey?: string
  stripe?: Stripe | Stripe.StripeConfig
}

export interface CustomerMetaData {
  ref: string
  application: string
  [name: string]: string
}

export interface CustomerQuery {
  field: keyof Pick<Stripe.CustomerCreateParams, { [Key in keyof Stripe.CustomerCreateParams]-?: Stripe.CustomerCreateParams[Key] extends string | undefined ? Key : never }[keyof Stripe.CustomerCreateParams]>
  metadata?: CustomerMetaData
}

export interface StripeTools {
  ensureCustomer: (customerId: string | undefined, params: Stripe.CustomerCreateParams, querydata?: CustomerQuery) => Promise<Stripe.Customer>
  setApiKey: (apiKey: string) => Stripe
}
