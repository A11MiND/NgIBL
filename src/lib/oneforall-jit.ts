import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { MembershipRole, Platform, Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { type OneForAllLaunchClaims } from '@/lib/oneforall-launch-token'

function slugForSchool(schoolId: string | number) {
  return `oneforall-${String(schoolId).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

export async function provisionOneForAllUser(claims: OneForAllLaunchClaims) {
  const organization = await prisma.organization.upsert({
    where: { slug: slugForSchool(claims.school_id) },
    create: {
      slug: slugForSchool(claims.school_id),
      name: `One For All School ${claims.school_id}`,
    },
    update: {},
  })

  const role = claims.role === 'student' ? Role.STUDENT : claims.role === 'admin' ? Role.ADMIN : Role.TEACHER
  const membershipRole = claims.role === 'student' ? MembershipRole.STUDENT : claims.role === 'admin' ? MembershipRole.ADMIN : MembershipRole.TEACHER
  const existing = await prisma.user.findUnique({ where: { email: claims.email } })
  const user = await prisma.user.upsert({
    where: { email: claims.email },
    create: {
      email: claims.email,
      password: await bcrypt.hash(crypto.randomUUID(), 10),
      name: claims.name || claims.email,
      role,
      globalUserId: claims.global_user_id,
      organizationId: organization.id,
    },
    update: {
      name: claims.name || existing?.name,
      role,
      globalUserId: claims.global_user_id,
      organizationId: organization.id,
    },
  })

  await prisma.userOrganizationMembership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: organization.id,
      },
    },
    create: {
      userId: user.id,
      organizationId: organization.id,
      role: membershipRole,
    },
    update: {
      role: membershipRole,
      status: 'ACTIVE',
    },
  })

  await prisma.globalUser.upsert({
    where: { id: claims.global_user_id },
    create: { id: claims.global_user_id },
    update: {},
  })

  await prisma.platformUserMapping.upsert({
    where: {
      platform_localUserId: {
        platform: Platform.IBL,
        localUserId: user.id,
      },
    },
    create: {
      globalUserId: claims.global_user_id,
      platform: Platform.IBL,
      localUserId: user.id,
      userId: user.id,
    },
    update: {
      globalUserId: claims.global_user_id,
      userId: user.id,
    },
  })

  return { user, organization, created: !existing }
}
