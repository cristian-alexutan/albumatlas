export const typeDefs = `#graphql
  type Album {
    id: ID!
    title: String!
    artist: String!
    year: Int!
    genre: String!
    coverUrl: String!
    description: String!
    rating: Float!
    featured: Boolean!
    tracks: [Track!]!
  }

  type Track {
    id: ID!
    albumId: ID!
    title: String!
    position: Int!
    durationSec: Int!
    album: Album
  }

  type AlbumsPage {
    items: [Album!]!
    page: Int!
    pageSize: Int!
    total: Int!
    totalPages: Int!
  }

  type GenreStat {
    genre: String!
    albumCount: Int!
  }

  type DecadeStat {
    decade: String!
    albumCount: Int!
  }

  type Statistics {
    albumCount: Int!
    averageRating: Float!
    byGenre: [GenreStat!]!
    byDecade: [DecadeStat!]!
    topRated: [Album!]!
  }

  type GeneratorStatus {
    running: Boolean!
  }

  type Query {
    albums(
      page: Int
      pageSize: Int
      search: String
      genre: String
      sort: AlbumSort
      order: SortOrder
    ): AlbumsPage!
    album(id: ID!): Album
    tracks(albumId: ID!): [Track!]
    track(id: ID!): Track
    statistics: Statistics!
    generatorStatus: GeneratorStatus!
  }

  enum AlbumSort {
    title
    year
    rating
    artist
  }

  enum SortOrder {
    asc
    desc
  }

  input AlbumInput {
    title: String!
    artist: String!
    year: Int!
    genre: String!
    coverUrl: String!
    description: String
    rating: Float
    featured: Boolean
  }

  input AlbumPatch {
    title: String
    artist: String
    year: Int
    genre: String
    coverUrl: String
    description: String
    rating: Float
    featured: Boolean
  }

  input TrackInput {
    title: String!
    position: Int!
    durationSec: Int!
  }

  input TrackPatch {
    title: String
    position: Int
    durationSec: Int
  }

  type Mutation {
    createAlbum(input: AlbumInput!): Album!
    updateAlbum(id: ID!, patch: AlbumPatch!): Album
    deleteAlbum(id: ID!): Boolean!

    createTrack(albumId: ID!, input: TrackInput!): Track
    updateTrack(id: ID!, patch: TrackPatch!): Track
    deleteTrack(id: ID!): Boolean!

    startGenerator: GeneratorStatus!
    stopGenerator: GeneratorStatus!
  }
`;
