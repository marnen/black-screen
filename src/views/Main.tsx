import Aliases from "../Aliases";
const reactDOM = require("react-dom");
/* tslint:disable:no-unused-variable */
import * as React from "react";
import ApplicationComponent from "./1_ApplicationComponent";
import {loadAllPlugins} from "../PluginManager";

$(() => {
    // FIXME: Remove after switching to Webpack (because all the files will be loaded at start anyway).
    loadAllPlugins()
        .then(() => reactDOM.render(<ApplicationComponent/>, document.getElementById("black-screen")) )
        .then(() => Aliases.all());
});
