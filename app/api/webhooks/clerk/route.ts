import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const SIGNING_SECRET = process.env.WEBHOOK_SECRET

  if (!SIGNING_SECRET) {
    throw new Error('Error: Please add WEBHOOK_SECRET from Clerk Dashboard to .env')
  }

  // Create new Svix instance with secret
  const wh = new Webhook(SIGNING_SECRET)

  // Get headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error: Missing Svix headers', {
      status: 400,
    })
  }

  // Get body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  let evt: WebhookEvent

  // Verify payload with headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error: Could not verify webhook:', err)
    return new Response('Error: Verification error', {
      status: 400,
    })
  }

  // Handle user creation and updates
  try {
    switch (evt.type) {
      case 'user.created':
        const { id, email_addresses, first_name, last_name } = evt.data
        const primaryEmail = email_addresses[0]?.email_address

        if (!primaryEmail) {
          throw new Error('No email address found')
        }

        // Create or update user
        await prisma.user.upsert({
          where: { id },
          create: {
            id,
            email: primaryEmail,
            name: `${first_name || ''} ${last_name || ''}`.trim() || null
          },
          update: {
            email: primaryEmail,
            name: `${first_name || ''} ${last_name || ''}`.trim() || null
          }
        })
        break

      case 'user.updated':
        const updatedUser = evt.data
        const updatedEmail = updatedUser.email_addresses[0]?.email_address

        if (!updatedEmail) {
          throw new Error('No email address found')
        }

        await prisma.user.update({
          where: { id: updatedUser.id },
          data: {
            email: updatedEmail,
            name: `${updatedUser.first_name || ''} ${updatedUser.last_name || ''}`.trim() || null
          }
        })
        break

      case 'user.deleted':
        await prisma.user.delete({
          where: { id: evt.data.id }
        })
        break
    }

    return new Response('Webhook processed successfully', { status: 200 })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response('Error processing webhook', { status: 500 })
  }
}