import { v } from "convex/values";
import { query } from "./_generated/server";

export const list = query({
  args: {
    limit: v.optional(v.number()),
    sort: v.optional(v.union(v.literal("points"), v.literal("eventsAttended"))),
  },
  handler: async (ctx, args) => {
    const { limit = 50, sort = "points" } = args;

    let profilesQuery = ctx.db.query("public_profiles");

    if (sort === "points") {
      profilesQuery = profilesQuery.order("desc");
    } else {
      profilesQuery = profilesQuery.withIndex("byEventsAttended");
    }

    const profiles = await profilesQuery.take(limit);

    return profiles.map((profile, index) => ({
      ...profile,
      _id: profile._id,
      rank: index + 1,
    }));
  },
});

export const getById = query({
  args: { id: v.id("public_profiles") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.id);
    if (!profile) return null;
    return { ...profile, _id: profile._id };
  },
});

export const getByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("public_profiles")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (!profile) return null;
    return { ...profile, _id: profile._id };
  },
});

export const getUserRank = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("public_profiles")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (!profile) return null;

    const allProfiles = await ctx.db
      .query("public_profiles")
      .order("desc")
      .collect();

    const rank = allProfiles.findIndex((p) => p._id === profile._id) + 1;

    return {
      rank,
      totalMembers: allProfiles.length,
      profile: { ...profile, _id: profile._id },
    };
  },
});
