# Album Atlas

Simple Next.js app for album browsing and in-memory CRUD.

## Scripts

- `npm run dev` - start development server
- `npm run lint` - run ESLint
- `npm run test` - run tests once
- `npm run test:watch` - run tests in watch mode
- `npm run test:coverage` - run tests with coverage report

## What is tested

- Browse filtering and pagination logic
- Album CRUD behavior in `AlbumsProvider`
- Add/Edit behavior in `AlbumForm`
- Delete behavior in `DeleteAlbumButton`

## Coverage output

After `npm run test:coverage`, open:

- `coverage/index.html`

