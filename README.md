# MapBites - Restaurant Map App

MapBites is a cross-platform mobile app that allows users to collect and explore restaurant locations from TikTok, Instagram, and other social media videos/photos.

## Features

- 🔐 **Authentication**: Email/password authentication with Supabase
- 🗺️ **Interactive Map**: Mapbox-powered map with restaurant pins
- 📱 **Media Import**: Import photos/videos from social media platforms
- 👤 **User Profiles**: Personal media library and restaurant collection
- 📍 **Location Services**: GPS-based location pinning and restaurant discovery

## Tech Stack

- **Frontend**: React Native with Expo
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Maps**: Mapbox React Native SDK
- **Navigation**: React Navigation
- **Language**: TypeScript

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- Supabase account
- Mapbox account

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd mobile-app
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```bash
cp env.example .env
```

Fill in your environment variables:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_access_token
```

### 3. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to the SQL Editor in your Supabase dashboard
3. Run the SQL commands from `supabase-schema.sql` to create the database schema
4. Enable authentication providers in Authentication > Settings
5. Create a storage bucket named "media" (this should be done automatically by the schema)

### 4. Mapbox Setup

1. Create an account at [mapbox.com](https://mapbox.com)
2. Generate an access token with the following scopes:
   - `styles:read`
   - `fonts:read`
   - `datasets:read`
   - `tilesets:read`
3. Add the token to your `.env` file

### 5. Run the App

For development:

```bash
# Start the development server
npx expo start

# Run on iOS simulator
npx expo start --ios

# Run on Android emulator
npx expo start --android
```

For testing share functionality, you'll need to build a development client:

```bash
# Build development client for iOS
npx expo run:ios

# Build development client for Android
npx expo run:android
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   └── AppNavigator.tsx # Main navigation component
├── hooks/              # Custom React hooks
│   └── useAuth.tsx     # Authentication context
├── screens/            # Screen components
│   ├── AuthScreen.tsx  # Login/signup screen
│   ├── MapScreen.tsx   # Main map view
│   └── ProfileScreen.tsx # User profile and media library
├── services/           # External service integrations
│   └── supabase.ts     # Supabase client configuration
├── types/              # TypeScript type definitions
│   ├── index.ts        # Main app types
│   └── database.ts     # Supabase database types
└── utils/              # Utility functions
```

## Database Schema

### Restaurants Table
- `id`: UUID primary key
- `name`: Restaurant name
- `address`: Restaurant address
- `latitude`/`longitude`: GPS coordinates
- `description`: Optional description
- `tags`: Array of tags
- `user_id`: Foreign key to auth.users

### Media Table
- `id`: UUID primary key
- `restaurant_id`: Foreign key to restaurants
- `user_id`: Foreign key to auth.users
- `file_url`: URL to stored media file
- `file_type`: 'image' or 'video'
- `file_name`: Original filename
- `file_size`: File size in bytes
- `metadata`: JSON metadata (EXIF, source, etc.)

## Features Implementation

### Authentication
- Supabase Auth handles user registration and login
- Row Level Security (RLS) ensures users only see their own data
- Context API provides authentication state throughout the app

### Map Integration
- Mapbox React Native SDK for interactive maps
- Custom pins for restaurant locations
- Tap to add new restaurants
- Modal dialogs for restaurant details

### Media Management
- Supabase Storage for file uploads
- Support for both images and videos
- EXIF metadata extraction for location data
- Media library in profile screen

### Share Integration
- iOS: Share extension integration
- Android: Intent handling for shared content
- Automatic metadata extraction from shared media

## Development Workflow

### Local Development
1. Use Expo Go for rapid development and testing
2. Hot reloading for instant feedback
3. Simulator/emulator testing

### Testing Share Functionality
1. Build custom development client
2. Install on physical device
3. Test share menu integration

### Production Deployment
1. Configure EAS Build for production builds
2. Submit to App Store/Google Play
3. Use EAS Update for over-the-air updates

## Future Enhancements

- 🔍 Search and filter restaurants
- 🤖 AI-assisted restaurant recognition
- 📱 Social sharing of restaurant discoveries
- 🏷️ Hashtag-based categorization
- 📊 Analytics and insights
- 🌍 Multi-language support

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
