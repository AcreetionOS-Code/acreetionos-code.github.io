import io.calamares.ui 1.0
import io.calamares.core 1.0

import QtQuick 2.3
import QtQuick.Layouts 1.3
import QtQuick.Controls 2.15

Rectangle {
    id: sideBar;
    color: Branding.styleString( Branding.SidebarBackground );
    height: 48;
    width: parent.width

    RowLayout {
        anchors.fill: parent;
        spacing: 2;

        Item {
            Layout.fillHeight: true;
        }

        Repeater {
            model: ViewManager
            Rectangle {
                Layout.leftMargin: 0;
                Layout.fillWidth: true;
                Layout.alignment: Qt.AlignTop;
                height: 42;
                radius: 0;
                color: Branding.styleString( index == ViewManager.currentStepIndex ? Branding.SidebarBackgroundCurrent : Branding.SidebarBackground );

                Text {
                    anchors.verticalCenter: parent.verticalCenter;
                    anchors.horizontalCenter: parent.horizontalCenter
                    x: parent.x + 12;
                    color: Branding.styleString( index == ViewManager.currentStepIndex ? Branding.SidebarTextCurrent : Branding.SidebarText );
                    text: display;
                    font.pointSize : index == ViewManager.currentStepIndex ? 10 : 9
                }

                Rectangle {
                    height: 2
                    width: 800
                    anchors.bottom: parent.bottom;
                    border.color: Branding.styleString(ViewManager.currentStepIndex === index ? Branding.SidebarTextCurrent : (ViewManager.currentStepIndex >= index ? Branding.SidebarTextCurrent : Branding.SidebarBackgroundCurrent))
                    border.width: 3
                }
            }
        }
    }
}