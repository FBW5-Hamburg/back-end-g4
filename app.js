const express = require('express')
const path = require('path')
const emailSender = require('./modules/emailSender')
const session = require('express-session')
const fileupload = require('express-fileupload')
const cookie = require('cookie-parser')
const fs = require('fs')

//const dataModule = require('./modules/mongodbDataModule')
const dataModule = require('./modules/mongooseDataModule')
//const dataModule = require('./modules/mysqlDataModule')
const adminRouter = require('./routes/adminRoutes')

const port = process.env.PORT || 3500


const app = express()

app.use(express.static(path.join(__dirname, '/public')))

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname,'views'))

app.use(express.urlencoded({extended: false}))
app.use(express.json())

const sessionOptions = {
    secret: 'drHouse',
    resave: false,
    saveUninitialized: false,
    cookie: {}
}

app.use(session(sessionOptions))
app.use(cookie())

app.use(fileupload({
    limits: {fileSize: 50 * 1024 *1024}
}))

app.use('/admin', adminRouter)

app.get('/', (req, res) => {
    res.render('main')
})

app.get('/about', (req, res) => {
    res.render('about')
})

app.get('/appointment', (req, res) => {
    res.render('appointment')
})

app.get('/blog', (req, res) => {
    res.render('blog')
})

app.get('/blog-single', (req, res) => {
    res.render('blog-single')
})

// app.get('/contact', (req, res) => {
//     res.render('contact')
// })

app.get('/department', (req, res) => {
    res.render('department')
})

app.get('/doctor', (req, res) => {
    res.render('doctor')
})

app.get('/pricing', (req, res) => {
    res.render('pricing')
})

//===email===//

app.get('/contact', (req, res) => {
    res.render('contact', {sent: 1})
});
app.post('/contact', (req, res) => {
    console.log(req.body);
    const name = req.body.name
    const email = req.body.email
    const subject = req.body.subject
    const message = req.body.message
    if(name != "" && name.length < 100 ){
        emailSender.sendEmail(name, email, subject, message, (ok) => {
            if(ok){
                res.sendStatus(200);
            } else{
                res.sendStatus(500);
            }
        });
    }
    
   
});
app.post('/contact1', (req, res) => {
    console.log(req.body);
    const name = req.body.name
    const email = req.body.email
    const subject = req.body.subject
    const message = req.body.message
    if(name != "" && name.length < 100 ){
        emailSender.sendEmail(name, email, subject, message, (ok) => {
            if(ok){
                //res.sendStatus(200);
                res.render('contact', {sent: 2})
            } else{
                //res.sendStatus(500);
                res.render('contact', {sent: 3})
            }
        });
    }
    
   
});

//=====email end====//




app.get('/register', (req, res) => {
    res.render('register')
})

app.post('/register', (req,res) => {
    // 1 user registered successfuly
    // 2 data error
    // 3 user is exist
    // 4 server error
    const email = req.body.email
    const password = req.body.password
    const repassword = req.body.repassword
    if ( email && password && password == repassword) {
        dataModule.registerUser(email, password).then(() => {
            res.json(1)
        }).catch(error => {
            console.log(error)
            if (error == 'exist') {
                res.json(3)
            } else {
                res.json(4)
            }
        })
    } else { 
        res.json(2)
    }
})


app.get('/login', (req, res) => {
    if (req.session.user) {
        res.redirect('/admin')
    } else {
        res.render('login')
    }
    
})


app.post('/login', (req, res) => {
    console.log(req.body)
    if(req.body.email && req.body.password) {
        dataModule.checkUser(req.body.email.trim(), req.body.password).then(user => {
            req.session.user = user
            //console.log(user)
            res.json(1)
        }).catch(error => {
            if (error == 3) {
                res.json(3)
            } else {
                res.json(4)
            }
        })
    } else {
        res.json(2)
    }
})

app.get('/ourPatients', (req, res) => {
    dataModule.getAllPatients().then(ourpatients => {
        res.render('ourPatients', {patients: ourpatients})
    })
});


app.get('/patient/:patienttitle/:id', (req, res) => {
    dataModule.getPatient(req.params.id).then(patient => {
        let checkLogin = false
        if(req.session.user) {
            checkLogin = true
        }
        res.render('patient', {patient, checkLogin})
    }).catch(error => {
        res.send('404, Patient couldn\'t be found')
    })
});


app.listen(port, () => {
    console.log(`App listening on port ${port}!`);
})