export function parseFeedItems(rawItems, ownerUsername) {
  if (!Array.isArray(rawItems)) return []

  return rawItems
    .map((item) => mapFeedItem(item, ownerUsername))
    .filter(Boolean)
}

function mapFeedItem(item, ownerUsername) {
  const code = item.code ?? item.shortcode
  if (!code) return null

  const isVideo = item.media_type === 2 || Boolean(item.video_versions?.length)
  const path = isVideo ? 'reel' : 'p'

  return {
    id: item.pk ?? item.id ?? code,
    shortCode: code,
    url: `https://www.instagram.com/${path}/${code}/`,
    caption: item.caption?.text ?? '',
    timestamp: item.taken_at ?? item.device_timestamp ?? null,
    likesCount: item.like_count ?? null,
    commentsCount: item.comment_count ?? null,
    displayUrl:
      item.image_versions2?.candidates?.[0]?.url ??
      item.video_versions?.[0]?.url ??
      null,
    isVideo,
    ownerUsername,
  }
}

export function parseProfileFromSharedData(user) {
  if (!user?.username) return null

  return {
    id: user.id ?? user.pk ?? null,
    username: user.username,
    fullName: user.full_name ?? '',
    biography: user.biography ?? '',
    followersCount: user.edge_followed_by?.count ?? user.follower_count ?? null,
    followsCount: user.edge_follow?.count ?? user.following_count ?? null,
    postsCount:
      user.edge_owner_to_timeline_media?.count ?? user.media_count ?? null,
    isPrivate: Boolean(user.is_private),
    isVerified: Boolean(user.is_verified),
    profilePicUrl: user.profile_pic_url_hd ?? user.profile_pic_url ?? null,
  }
}

export function extractFeedFromResponseBody(body) {
  if (!body || typeof body !== 'object') return []

  if (Array.isArray(body.items)) return body.items

  const timeline =
    body.data?.user?.edge_owner_to_timeline_media?.edges ??
    body.user?.edge_owner_to_timeline_media?.edges

  if (Array.isArray(timeline)) {
    return timeline.map((edge) => edge.node).filter(Boolean)
  }

  return []
}
