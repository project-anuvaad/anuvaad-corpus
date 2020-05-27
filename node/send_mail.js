const html_content = `<!DOCTYPE html>
<html>

<head>
   
</head>

<body style="margin: 0; padding: 10px;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="630"
        style="font-family: Arial, Helvetica, sans-serif;">
        <tr bgcolor="#f1f5f7">
            <td align="center" style=" padding:  0px 0 30px 0;">

                <img src="https://auth.anuvaad.org/download/anuvaad_logo.png" alt="anuvaad logo" width="630" height="250px"
                    style="display: block;" />
            </td>
        </tr>
        <tr bgcolor="#f1f5f7">
            <td align="center" style="color:black;padding: 10px 0 5px 0; ">
                <h1 style="color:#003366 ;margin-bottom: 10px; font-family: Arial, Helvetica, sans-serif;">Create Password</h1>
                <p style="font-size: 8x; align-items:center;font-style: italic;">You've received this email because you have registered on 
                <br/> <a href="https://users.anuvaad.org" target="_blank" style="text-decoration: none;color:#1ca9c9">users.anuvaad.org.</a>  If it's not you, please click here to 
                <a href="" target="_blank" style="text-decoration:none;color:#1ca9c9">unsubscribe.</a></p>
                <br/>
                <hr style="height:2px; border-width: 0; width: 80%; background-Color:  #D8D8D8; color: #D8D8D8;border: 0;">
            </td>
        </tr>
        <tr bgcolor="#f1f5f7">
            <td align="center" style="padding: 5px 0 100px 0;">
                <p style="font-size: 16px; font-family: Arial, Helvetica, sans-serif;">Please click here to confirm yourself and create your password.</p>
                <a href="https://users.anuvaad.org"> 
                <button  variant="contained" aria-label="edit" style=
                    "cursor:pointer;width: 66%; height:42px; margin-Bottom: 2%; margin-Top: 5px;
                    background-Color: #1ca9c9; color: white; border-radius:25px ;border:0; font-size:15px ; font-family: Arial, Helvetica, sans-serif;"
                  >
                        Confirm Email</button>
                    </a>
                <!-- <button type="button" class="btn btn-success btn-lg" ><b>Sign Up</b></button>   -->
                <p style="font-size: 15px; font-family: Arial, Helvetica, sans-serif;">You can also paste the below link on your browser tab <br/>and open it to create a password.</p>
            </td>
        </tr>
    </table>
</body>

</html>`


var Mailer = require('./utils/mailer')

Mailer.send_email('aroop92@gmail.com','Welcome to Anuvaad',html_content)