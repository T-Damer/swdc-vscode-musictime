import React, { useEffect, useState } from "react";
import Account from "./components/account";
import { createMuiTheme, ThemeProvider } from "@material-ui/core/styles";
import CssBaseline from "@material-ui/core/CssBaseline";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import Setup from "./components/setup";
import ColdStart from "./components/cold_start";
import Playlists from "./components/playlists";
import Metrics from "./components/metrics";
import Recommendations from "./components/recommendations";
import AppBar from "@material-ui/core/AppBar";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Box from "@material-ui/core/Box";
import { TOP_APP_BAR_MIN_HEIGHT, BOTTOM_BAR_HEIGHT, GETTING_STARTED_MIN_HEIGHT } from "../utils/view_constants";
import { deepPurple, grey, orange } from "@material-ui/core/colors";

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    padding: 0,
    margin: 0,
  },
  tabIndicator: {
    backgroundColor: "#ffffff",
  },
  bottomNav: {
    background: "transparent",
    flexGrow: 1,
    width: "100%",
    margin: 0,
  },
  accountBox: {
    height: `${BOTTOM_BAR_HEIGHT}px`,
    top: "auto",
    bottom: 0,
  },
  bottomNavLabel: {
    marginTop: 5,
    fontWeight: 400,
  },
}));

export default function SideBar(props) {
  const classes = useStyles();

  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    if (tabValue !== props.stateData.selectedTabView) {
      setTabValue(props.stateData.selectedTabView);
    }
  });

  const currentColorKind = props.stateData.currentColorKind;
  const prefersDarkMode = !!(currentColorKind === 2);

  const theme = React.useMemo(
    () =>
      createMuiTheme({
        typography: {
          fontFamily: [
            "Inter",
            "-apple-system",
            "BlinkMacSystemFont",
            "Segoe UI",
            "Roboto",
            "Oxygen",
            "Ubuntu",
            "Cantarell",
            "Fira Sans",
            "Droid Sans",
            "Helvetica Neue",
            "sans-serif",
          ].join(","),
          fontSize: 12,
          fontWeightLight: 400,
          fontWeightRegular: 500,
          fontWeightMedium: 600,
        },
        palette: {
          type: prefersDarkMode ? "dark" : "light",
          primary: deepPurple,
          secondary: orange,
        },
        overrides: {
          MuiGrid: {
            root: {
              flexGrow: 1,
              width: "100%",
              margin: 0,
              padding: 0,
              backgroundColor: "transparent",
            },
          },
          MuiButton: {
            root: {
              minHeight: 0,
              minWidth: 0,
              width: "100%",
              textTransform: "none",
              whiteSpace: "nowrap",
              fontSize: 12,
            },
            contained: {
              padding: 5,
            },
            label: {
              padding: 1,
              margin: 1,
            },
          },
          MuiCard: {
            root: {
              padding: 4,
              margin: 2,
              width: "100%",
            },
          },
          MuiCardContent: {
            root: {
              width: "100%",
              paddingTop: 8,
              paddingBottom: 8,
              paddingLeft: 16,
              paddingRight: 16,
              "&:last-child": {
                paddingBottom: 24,
              },
            },
          },
          MuiDivider: {
            root: {
              width: "100%",
              marginTop: 4,
              marginBottom: 4,
            },
          },
          MuiList: {
            root: {
              width: "100%",
            },
          },
          MuiListItemText: {
            root: {
              marginTop: 0,
            },
            primary: {
              fontWeight: 500,
              fontSize: 12,
            },
            secondary: {
              color: grey[500],
            },
          },
          MuiListItemSecondaryAction: {
            root: {
              right: 0,
            },
          },
          MuiBottomNavigationAction: {
            label: {
              color: grey[100],
              fontWeight: 600,
            },
          },
        },
      }),
    [prefersDarkMode]
  );

  function changeTabView(event, newValue) {
    console.log("tab value: ", JSON.stringify(newValue));
    // update the tab view
    const updateCmd = {
      action: "musictime.updateSelectedTabView",
      command: "command_execute",
      arguments: [newValue],
    };
    props.vscode.postMessage(updateCmd);
    setTabValue(newValue);
  }

  return (
    <ThemeProvider theme={theme}>
      <div className={classes.root}>
        <CssBaseline />
        <AppBar position="static" color="primary" id="top-app-bar">
          {!props.stateData.registered || !props.stateData.spotifyUser ? (
            <Grid container style={{ margin: 0, padding: 0, width: "100%", height: "100%" }}>
              <Grid item key="setup-user-grid-item" xs={12} style={{ margin: 0, padding: 0 }}>
                <Setup stateData={props.stateData} vscode={props.vscode} />
              </Grid>
            </Grid>
          ) : (
            <Tabs
              value={tabValue}
              onChange={changeTabView}
              centered
              variant="fullWidth"
              aria-label="musictime-tabs"
              classes={{ indicator: classes.tabIndicator }}
            >
              <Tab label="Playlists" value="playlists" />
              <Tab label="Recommendations" value="recommendations" />
              <Tab label="Metrics" value="metrics" />
            </Tabs>
          )}
        </AppBar>
        <Grid
          container
          style={{
            position: "absolute",
            overflowX: "hidden",
            top: !props.stateData.spotifyUser ? GETTING_STARTED_MIN_HEIGHT : TOP_APP_BAR_MIN_HEIGHT,
            bottom: !props.stateData.spotifyUser ? 0 : BOTTOM_BAR_HEIGHT,
          }}
        >
          {!props.stateData.spotifyUser && (
            <Grid item key="cold-start-grid-item" xs={12}>
              <ColdStart vscode={props.vscode} stateData={props.stateData} />
            </Grid>
          )}

          {props.stateData.selectedTabView === "playlists" && props.stateData.spotifyUser && (
            <Grid item key="playlists-grid-item" xs={12}>
              <Playlists vscode={props.vscode} stateData={props.stateData} />
            </Grid>
          )}

          {props.stateData.selectedTabView === "recommendations" && props.stateData.spotifyUser && (
            <Grid item key="recommendations-grid-item" xs={12}>
              <Recommendations vscode={props.vscode} stateData={props.stateData} />
            </Grid>
          )}

          {props.stateData.selectedTabView === "metrics" && props.stateData.spotifyUser && (
            <Grid item key="metrics-grid-item" xs={12}>
              <Metrics vscode={props.vscode} stateData={props.stateData} />
            </Grid>
          )}
        </Grid>
        {props.stateData.registered && (
          <Box position="fixed" className={classes.accountBox}>
            <Account vscode={props.vscode} stateData={props.stateData} />
          </Box>
        )}
      </div>
    </ThemeProvider>
  );
}
