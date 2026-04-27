import io.calamares.ui 1.0
import io.calamares.core 1.0

import QtQuick 2.3
import QtQuick.Layouts 1.3
import QtQuick.Controls 2.15

Rectangle {
    id: navigation;
    color: Branding.styleString( Branding.SidebarBackground );

    RowLayout {
        anchors.centerIn: parent;
        spacing: 6;

        Button {
            text: qsTr("Back")
            icon.name: "go-previous"
            onClicked: ViewManager.back();
            enabled: ViewManager.currentStepIndex > 0
            Layout.preferredWidth: 120
        }

        Button {
            text: ViewManager.currentStepIndex === ViewManager.rowCount() - 1 ? qsTr("Install") : qsTr("Next")
            icon.name: "go-next"
            onClicked: ViewManager.next();
            Layout.preferredWidth: 120
        }
    }
}