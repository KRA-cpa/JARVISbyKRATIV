# JARVIS / Daloy by KRAtiv - Ticketing & Workflow Orchestration System

**Daloy** (Tagalog for "flow") by **KRAtiv Solutions** is the product name; **JARVIS** is the internal / repo name (`jarvisbyerp`).

This project is a React-based multi-tenant ticketing system with workflow orchestration capabilities.

## 📋 MANDATORY DEVELOPMENT REFERENCES

**⚠️ BEFORE ANY DEVELOPMENT WORK, CONSULT THESE REQUIRED DOCUMENTS:**
- **`docs/reference/PRODUCTION_REQUIREMENTS.md`** - 🚨 **CRITICAL** - Node.js, CSS, runtime requirements, and proof of concept database documentation
- **`Claude.md`** - Complete functional specifications and architecture overview
- **`docs/reference/DEVELOPMENT_PLAN.md`** - 43-file structure, hooks documentation, and dependency hierarchy
- **`docs/reference/DEPENDENCY_MAPPING.md`** - Component relationships and import/export rules
- **`docs/reference/SUPERTHINK_AUDIT.md`** - Code quality standards and audit methodology

## 📁 Repository Layout

| Folder | Contents |
|---|---|
| `docs/reference/` | Mandatory development references and database schema |
| `docs/guides/` | Setup, testing and how-to guides |
| `docs/design/` | Feature designs and system analyses |
| `docs/planning/` | Active TODOs and plans |
| `docs/backups/` | Conversation backup system docs |
| `docs/archive/` | Finished audits and superseded docs |
| `appscript_files/` | Google Apps Script backend — latest `APPSCRIPT_v<ver>_<YYYYMMDD>_<HHMM>.txt` + deploy guide |

Full layout and rules: see the 📁 REPO LAYOUT section in `Claude.md`.

## Production Requirements

**Current Stack:**
- **Node.js**: v22.14.0 (minimum v18.0.0)
- **React**: v19.1.0 with React Router v7
- **Styling**: Tailwind CSS v3.4.17 + Material-UI v7
- **Authentication**: Firebase v11.9.0
- **Database**: ⚠️ **PROOF OF CONCEPT** - Google Sheets + Apps Script API
- **Deployment**: Vercel (React SPA)

### **🔬 Proof of Concept Notice**
This system uses Google Sheets + Apps Script as a proof of concept database backend. While fully functional, it's not suitable for high-volume production use. Future migration to traditional database planned.

**See `docs/reference/PRODUCTION_REQUIREMENTS.md` for complete dependency documentation.**

---

# Create React App Documentation

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
