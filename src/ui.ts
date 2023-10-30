// Handles user interactions in the extension
import * as vscode from 'vscode';

class UIHandler {
  async getHarvestToken() {
    const accessToken = await vscode.window.showInputBox({ placeHolder: 'Access Token from Harvest', ignoreFocusOut: true });
    if (accessToken === undefined) {
      return;
    }
    const accountId = await vscode.window.showInputBox({ placeHolder: 'Account/Organization ID from Harvest', ignoreFocusOut: true });
    if (accountId === undefined) {
      return;
    }
    return { accessToken, accountId };
  }
}

export default UIHandler;